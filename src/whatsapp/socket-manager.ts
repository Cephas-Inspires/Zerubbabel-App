import { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  Browsers,
  type WASocket,
  type ConnectionState
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { EventEmitter } from 'node:events';
import { config } from '../config/index.js';
import { 
  upsertContact, 
  appendGroupMessage, 
  updateDraftStatus 
} from '../db/index.js';
import { 
  SocketRole, 
  SocketConnectionStatus, 
  SocketStatusPayload, 
  IncomingMessageEvent 
} from './types.js';

export class WhatsAppSocketManager extends EventEmitter {
  public readonly role: SocketRole;
  public readonly phone: string;
  public readonly authDir: string;
  private socket: WASocket | null = null;
  private status: SocketConnectionStatus = 'disconnected';
  private qrCodeString: string | undefined;
  private pairingCodeString: string | undefined;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(role: SocketRole, phone: string, authDir: string) {
    super();
    this.role = role;
    this.phone = phone.replace(/\D/g, '');
    this.authDir = authDir;
  }

  public getStatus(): SocketStatusPayload {
    return {
      role: this.role,
      phone: this.phone,
      status: this.status,
      qrCode: this.qrCodeString,
      pairingCode: this.pairingCodeString,
      userJid: this.socket?.user?.id,
      lastConnectedAt: this.status === 'connected' ? new Date().toISOString() : undefined
    };
  }

  public async start(usePairingCode = false): Promise<void> {
    const logger = pino({ level: 'silent' });
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    console.log(`🔌 [WhatsApp] Initializing socket for ${this.role} (${this.phone})...`);
    this.status = 'connecting';
    this.emit('status', this.getStatus());

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.ubuntu(config.assistantName),
      markOnlineOnConnect: this.role === 'assistant_dispatcher',
      syncFullHistory: false
    });

    // Save auth credentials whenever updated
    this.socket.ev.on('creds.update', saveCreds);

    // If pairing code is requested and not registered
    if (usePairingCode && !state.creds.registered && this.phone) {
      setTimeout(async () => {
        try {
          if (this.socket && !this.socket.authState.creds.registered) {
            console.log(`📲 [WhatsApp ${this.role}] Requesting pairing code for +${this.phone}...`);
            const code = await this.socket.requestPairingCode(this.phone);
            this.pairingCodeString = code;
            this.status = 'pairing_code_ready';
            console.log(`\n========================================`);
            console.log(`🔑 PAIRING CODE FOR [${this.role.toUpperCase()}]: ${code}`);
            console.log(`========================================\n`);
            this.emit('status', this.getStatus());
          }
        } catch (err: any) {
          console.error(`❌ [WhatsApp ${this.role}] Failed to request pairing code:`, err?.message || err);
        }
      }, 3000);
    }

    // Connection state changes
    this.socket.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCodeString = qr;
        this.status = 'qr_ready';
        console.log(`\n📷 [WhatsApp QR] Scan with phone for [${this.role.toUpperCase()} - +${this.phone}]:`);
        qrcode.generate(qr, { small: true });
        this.emit('status', this.getStatus());
      }

      if (connection === 'open') {
        console.log(`✅ [WhatsApp ${this.role}] Connected successfully! (JID: ${this.socket?.user?.id})`);
        this.status = 'connected';
        this.qrCodeString = undefined;
        this.pairingCodeString = undefined;
        this.reconnectAttempts = 0;
        this.emit('status', this.getStatus());
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.warn(`⚠️ [WhatsApp ${this.role}] Connection closed. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          this.status = 'logged_out';
          this.emit('status', this.getStatus());
        } else if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.status = 'connecting';
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`🔄 [WhatsApp ${this.role}] Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
          setTimeout(() => this.start(usePairingCode), delay);
        } else {
          this.status = 'disconnected';
          this.emit('status', this.getStatus());
        }
      }
    });

    // Ingest incoming messages
    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message) continue;

        const isFromMe = msg.key.fromMe || false;
        const remoteJid = msg.key.remoteJid || '';
        const isGroup = remoteJid.endsWith('@g.us');
        const participantJid = isGroup ? (msg.key.participant || '') : remoteJid;
        const senderPhone = participantJid.replace(/@.*$/, '').replace(/\D/g, '');
        const senderName = msg.pushName || null;

        // Extract text content
        const text = 
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          '';

        if (!text.trim()) continue;

        // 1. Contact Harvesting: Upsert contact into SQLite address book
        if (senderPhone && senderPhone.length > 5) {
          upsertContact(
            senderPhone, 
            senderName, 
            this.role === 'personal_observer' ? 'personal_whatsapp' : 'assistant_whatsapp'
          );
        }

        // 2. Check if tagged (Zerubbabel or Assistant SIM)
        const isTagged = 
          text.toLowerCase().includes('@zerub') || 
          text.toLowerCase().includes('zerubbabel') || 
          text.includes(config.zerubAssistantPhone);

        // 3. Record in group rolling buffer if group message
        if (isGroup) {
          appendGroupMessage(
            remoteJid,
            null, // Group name populated dynamically when known
            participantJid,
            senderName,
            text,
            typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
            isTagged,
            msg.key.id || null
          );
        }

        const eventPayload: IncomingMessageEvent = {
          role: this.role,
          senderJid: participantJid,
          senderPhone,
          senderName,
          isGroup,
          groupJid: isGroup ? remoteJid : undefined,
          messageText: text,
          timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
          isZerubTagged: isTagged,
          rawMessageId: msg.key.id || ''
        };

        this.emit('message', eventPayload);
      }
    });
  }

  /**
   * Strictly for Socket 2 (Assistant SIM) to dispatch approved messages or group replies.
   * Socket 1 is forbidden from calling this.
   */
  public async sendMessage(
    targetJid: string, 
    text: string, 
    draftId?: number
  ): Promise<boolean> {
    if (this.role === 'personal_observer') {
      throw new Error('SECURITY VIOLATION: Socket 1 (Personal Observer) is strictly passive and prohibited from sending messages.');
    }

    if (!this.socket || this.status !== 'connected') {
      throw new Error(`Socket 2 is not connected (current status: ${this.status}). Cannot dispatch message.`);
    }

    const formattedJid = targetJid.includes('@') 
      ? targetJid 
      : `${targetJid.replace(/\D/g, '')}@s.whatsapp.net`;

    try {
      await this.socket.sendMessage(formattedJid, { text });
      console.log(`📤 [WhatsApp Assistant] Dispatched message to ${formattedJid}`);

      if (draftId) {
        updateDraftStatus(draftId, 'sent');
      }

      return true;
    } catch (error: any) {
      console.error(`❌ [WhatsApp Assistant] Failed to send message to ${formattedJid}:`, error);
      if (draftId) {
        updateDraftStatus(draftId, 'pending_approval', error.message || 'Dispatch failure');
      }
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        await this.socket.end(undefined);
      } catch {
        // ignore disconnect errors
      }
      this.socket = null;
      this.status = 'disconnected';
      this.emit('status', this.getStatus());
    }
  }
}

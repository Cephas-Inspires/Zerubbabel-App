export type SocketRole = 'personal_observer' | 'assistant_dispatcher';

export type SocketConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'pairing_code_ready'
  | 'connected'
  | 'logged_out';

export interface SocketStatusPayload {
  role: SocketRole;
  phone: string;
  status: SocketConnectionStatus;
  qrCode?: string;
  qrDataUrl?: string;
  pairingCode?: string;
  userJid?: string;
  lastConnectedAt?: string;
}

export interface IncomingMessageEvent {
  role: SocketRole;
  senderJid: string;
  senderPhone: string;
  senderName: string | null;
  isGroup: boolean;
  groupJid?: string;
  groupName?: string;
  messageText: string;
  timestamp: number;
  isZerubTagged: boolean;
  rawMessageId: string;
  fromMe?: boolean;
  remoteJid?: string;
}

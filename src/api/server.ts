import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config/index.js';
import { 
  getPendingDrafts, 
  getDraftById, 
  updateDraftStatus, 
  searchContacts, 
  getAllContacts, 
  getHabitsForDate, 
  upsertHabitLog, 
  saveChatMessage, 
  getRecentChatHistory, 
  getMeetingSessions 
} from '../db/index.js';
import { WhatsAppSocketManager } from '../whatsapp/socket-manager.js';
import { aiRouter } from '../ai/router.js';
import { GoogleAuthManager } from '../google/auth.js';

export class ApiServer {
  private app = express();
  private server = createServer(this.app);
  private wss = new WebSocketServer({ server: this.server });
  private personalSocket: WhatsAppSocketManager;
  private assistantSocket: WhatsAppSocketManager;
  private startTime = Date.now();

  constructor(personalSocket: WhatsAppSocketManager, assistantSocket: WhatsAppSocketManager) {
    this.personalSocket = personalSocket;
    this.assistantSocket = assistantSocket;
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupWebSockets();
  }

  private setupMiddlewares() {
    this.app.use(cors());
    this.app.use(express.json());

    // Security check: optional API token validation for local IPC
    this.app.use((req, res, next) => {
      // Localhost is always trusted; if remote, require token
      const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
      const providedKey = req.headers['x-api-key'] || req.query.api_key;
      if (isLocal || !config.apiKey || providedKey === config.apiKey) {
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized: Invalid x-api-key' });
    });
  }

  private setupWebSockets() {
    this.wss.on('connection', (ws: WebSocket) => {
      // Send immediate initial state
      ws.send(JSON.stringify({
        type: 'INITIAL_STATE',
        payload: {
          socket1: this.personalSocket.getStatus(),
          socket2: this.assistantSocket.getStatus(),
          pendingDrafts: getPendingDrafts(),
          todayHabits: getHabitsForDate(new Date().toISOString().split('T')[0])
        }
      }));
    });

    // Forward socket status updates to all connected UI clients
    this.personalSocket.on('status', (payload) => {
      this.broadcast('SOCKET1_STATUS', payload);
    });

    this.assistantSocket.on('status', (payload) => {
      this.broadcast('SOCKET2_STATUS', payload);
    });
  }

  public broadcast(type: string, payload: any) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  private setupRoutes() {
    // 1. Overall System Health & Status
    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json({
        status: 'online',
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString(),
        host: 'Samsung S20FE (Local Android Daemon)',
        whatsapp: {
          socket1_personal: this.personalSocket.getStatus(),
          socket2_assistant: this.assistantSocket.getStatus()
        },
        ai: {
          provider: 'Google Gemini',
          configured: !!config.geminiApiKey,
          tier1_router: config.modelTier1Router,
          tier2_workhorse: config.modelTier2Workhorse,
          tier3_deep: config.modelTier3Deep
        },
        google: {
          configured: GoogleAuthManager.isConfigured()
        }
      });
    });

    // 2. Executive Chat (Cephas <-> Zerubbabel)
    this.app.get('/api/chat', (req: Request, res: Response) => {
      const history = getRecentChatHistory(50);
      res.json({ messages: history });
    });

    this.app.post('/api/chat', async (req: Request, res: Response) => {
      try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
          return res.status(400).json({ error: 'Message text is required' });
        }

        // Save Cephas's message
        saveChatMessage('user', message);

        // Process through Tier 2 Executive Flash
        const result = await aiRouter.executeTask('executive_chat', message);

        // Save Zerubbabel's response
        const assistantMsg = saveChatMessage('assistant', result.text, result.actualTier);

        this.broadcast('CHAT_MESSAGE', assistantMsg);

        res.json({
          reply: result.text,
          tier: result.actualTier,
          model: result.modelUsed
        });
      } catch (error: any) {
        console.error('Chat processing error:', error);
        res.status(500).json({ error: error.message || 'Failed to process executive chat message' });
      }
    });

    // 3. Two-Stage Draft Queue
    this.app.get('/api/drafts', (req: Request, res: Response) => {
      const drafts = getPendingDrafts();
      res.json({ drafts });
    });

    this.app.post('/api/drafts/:id/approve', async (req: Request, res: Response) => {
      const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const draftId = parseInt(paramId, 10);
      const draft = getDraftById(draftId);

      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      if (draft.status !== 'pending_approval') {
        return res.status(400).json({ error: `Draft is already ${draft.status}` });
      }

      try {
        updateDraftStatus(draftId, 'approved');
        
        // Append official signature
        const messageToSend = `${draft.draft_text}\n\n${config.outboundSignature}`;
        
        // Dispatch via Socket 2 (Assistant SIM)
        await this.assistantSocket.sendMessage(draft.recipient_phone, messageToSend, draftId);

        this.broadcast('DRAFT_UPDATED', { id: draftId, status: 'sent' });

        res.json({ success: true, message: 'Draft approved and dispatched via WhatsApp Socket 2' });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to dispatch approved draft' });
      }
    });

    this.app.post('/api/drafts/:id/cancel', (req: Request, res: Response) => {
      const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const draftId = parseInt(paramId, 10);
      updateDraftStatus(draftId, 'rejected', 'User cancelled via Executive Cockpit');
      this.broadcast('DRAFT_UPDATED', { id: draftId, status: 'rejected' });
      res.json({ success: true, message: 'Draft rejected' });
    });

    // 4. Contacts Address Book
    this.app.get('/api/contacts', (req: Request, res: Response) => {
      const query = req.query.q as string | undefined;
      if (query) {
        res.json({ contacts: searchContacts(query) });
      } else {
        res.json({ contacts: getAllContacts(100) });
      }
    });

    // 5. Habits
    this.app.get('/api/habits', (req: Request, res: Response) => {
      const today = (req.query.date as string) || new Date().toISOString().split('T')[0];
      res.json({ habits: getHabitsForDate(today) });
    });

    this.app.post('/api/habits/:key', (req: Request, res: Response) => {
      const paramKey = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const key = String(paramKey);
      const { title, status, notes } = req.body;
      const today = new Date().toISOString().split('T')[0];
      
      upsertHabitLog(key, title || key, today, status || 'completed', notes);
      const habits = getHabitsForDate(today);
      this.broadcast('HABITS_UPDATED', habits);
      res.json({ success: true, habits });
    });

    // 6. Meetings
    this.app.get('/api/meetings', (req: Request, res: Response) => {
      res.json({ meetings: getMeetingSessions(20) });
    });
  }

  public listen(port: number, host: string): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, host, () => {
        console.log(`🌐 [ApiServer] Zerubbabel API listening on http://${host}:${port}`);
        console.log(`📡 [ApiServer] WebSocket Server active on ws://${host}:${port}`);
        resolve();
      });
    });
  }
}

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/index.js';
import { getPendingDrafts, searchContacts, getAllContacts, getHabitsForDate, upsertHabitLog, saveChatMessage, getRecentChatHistory, getMeetingSessions, getExpensesForMonth } from '../db/index.js';
import { aiRouter } from '../ai/router.js';
import { GoogleAuthManager } from '../google/auth.js';
import { DraftEngine } from '../services/draft-engine.js';
import { renderCockpitHtml } from './cockpit-ui.js';
import { generateAppIcon } from './icon-generator.js';
export class ApiServer {
    app = express();
    server = createServer(this.app);
    wss = new WebSocketServer({ server: this.server });
    personalSocket;
    assistantSocket;
    draftEngine;
    startTime = Date.now();
    constructor(personalSocket, assistantSocket) {
        this.personalSocket = personalSocket;
        this.assistantSocket = assistantSocket;
        this.draftEngine = new DraftEngine(assistantSocket);
        this.setupMiddlewares();
        this.setupRoutes();
        this.setupWebSockets();
    }
    setupMiddlewares() {
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
    setupWebSockets() {
        this.wss.on('connection', (ws) => {
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
    broadcast(type, payload) {
        const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
        for (const client of this.wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        }
    }
    setupRoutes() {
        // 0. Dedicated Executive Mobile Cockpit App (PWA / Mobile UI)
        this.app.get(['/', '/cockpit'], (req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.send(renderCockpitHtml(config.port));
        });
        // 0.01 Web App Manifest for Android Chrome PWA Installation
        this.app.get('/manifest.json', (req, res) => {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.json({
                name: 'Zerubbabel Executive Assistant',
                short_name: 'Zerubbabel',
                start_url: '/',
                id: '/',
                display: 'standalone',
                background_color: '#0b0f19',
                theme_color: '#0b0f19',
                description: 'Autonomous AI Executive Assistant (Chief of Staff for Cephas)',
                icons: [
                    {
                        src: '/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: '/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            });
        });
        // 0.02 Service Worker for Native Android WebAPK / Standalone Installation
        this.app.get('/sw.js', (req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.send(`
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => clients.claim());
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
      `);
        });
        // 0.03 Dynamic High-Resolution App Icons (PNG)
        const icon192 = generateAppIcon(192);
        const icon512 = generateAppIcon(512);
        this.app.get('/icon-192.png', (req, res) => {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(icon192);
        });
        this.app.get('/icon-512.png', (req, res) => {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(icon512);
        });
        // 0.1 Live Visual Pairing Dashboard (Laptop Browser / Mobile Web)
        this.app.get('/pair', (req, res) => {
            const s1 = this.personalSocket.getStatus();
            const s2 = this.assistantSocket.getStatus();
            res.setHeader('Content-Type', 'text/html');
            res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zerubbabel — Dual WhatsApp Pairing Console</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; margin: 0; padding: 24px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #60a5fa; margin-bottom: 8px; }
    p.subtitle { color: #9ca3af; margin-top: 0; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #1f2937; border-radius: 12px; padding: 20px; border: 1px solid #374151; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; margin-bottom: 12px; }
    .badge-connecting { background: #ca8a04; color: #fff; }
    .badge-qr { background: #2563eb; color: #fff; }
    .badge-connected { background: #16a34a; color: #fff; }
    .badge-disconnected { background: #dc2626; color: #fff; }
    .qr-box { background: white; padding: 16px; border-radius: 8px; display: flex; justify-content: center; align-items: center; margin: 16px 0; min-height: 260px; }
    .qr-box img { max-width: 250px; height: auto; }
    .info { font-size: 14px; color: #d1d5db; line-height: 1.5; }
    ol { margin: 8px 0; padding-left: 20px; font-size: 13px; color: #9ca3af; }
  </style>
  <script>
    // Auto refresh every 3 seconds until both connected
    setTimeout(() => location.reload(), 3000);
  </script>
</head>
<body>
  <div class="container">
    <h1>🏛️ Zerubbabel WhatsApp Pairing Console</h1>
    <p class="subtitle">100% Phone-Hosted Autonomous AI Assistant • Dual WhatsApp Engine</p>
    
    <div class="grid">
      <!-- Socket 1: Personal WhatsApp -->
      <div class="card">
        <h3>📱 Socket 1: Personal Observer</h3>
        <p class="info">Target: <strong>+${s1.phone}</strong> (Cephas Personal)</p>
        <span class="badge badge-${s1.status === 'connected' ? 'connected' : (s1.status === 'qr_ready' ? 'qr' : 'connecting')}">
          STATUS: ${s1.status.toUpperCase()}
        </span>
        
        <div class="qr-box">
          ${s1.status === 'connected'
                ? '<h3 style="color: #16a34a;">✅ Connected & Observing!</h3>'
                : (s1.qrDataUrl
                    ? '<img src="' + s1.qrDataUrl + '" alt="Socket 1 QR Code" />'
                    : '<p style="color:#6b7280;">Generating QR code...</p>')}
        </div>

        <ol>
          <li>Open WhatsApp on personal phone (<strong>+${s1.phone}</strong>)</li>
          <li>Tap <strong>Settings / ⋮</strong> &gt; <strong>Linked Devices</strong></li>
          <li>Tap <strong>Link a Device</strong> &amp; point camera at the QR code</li>
        </ol>
      </div>

      <!-- Socket 2: Assistant SIM -->
      <div class="card">
        <h3>🤖 Socket 2: Assistant SIM</h3>
        <p class="info">Target: <strong>+${s2.phone}</strong> (Zerubbabel SIM)</p>
        <span class="badge badge-${s2.status === 'connected' ? 'connected' : (s2.status === 'qr_ready' ? 'qr' : 'connecting')}">
          STATUS: ${s2.status.toUpperCase()}
        </span>
        
        <div class="qr-box">
          ${s2.status === 'connected'
                ? '<h3 style="color: #16a34a;">✅ Connected & Ready!</h3>'
                : (s2.qrDataUrl
                    ? '<img src="' + s2.qrDataUrl + '" alt="Socket 2 QR Code" />'
                    : '<p style="color:#6b7280;">Generating QR code...</p>')}
        </div>

        <ol>
          <li>Open WhatsApp on assistant line (<strong>+${s2.phone}</strong>)</li>
          <li>Tap <strong>Settings / ⋮</strong> &gt; <strong>Linked Devices</strong></li>
          <li>Tap <strong>Link a Device</strong> &amp; point camera at the QR code</li>
        </ol>
      </div>
    </div>
  </div>
</body>
</html>
      `);
        });
        // 1. Overall System Health & Status
        this.app.get('/api/status', (req, res) => {
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
        this.app.get('/api/chat', (req, res) => {
            const history = getRecentChatHistory(50);
            res.json({ messages: history });
        });
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { message } = req.body;
                if (!message || typeof message !== 'string') {
                    return res.status(400).json({ error: 'Message text is required' });
                }
                // Save Cephas's message to SQLite
                saveChatMessage('user', message);
                // Step 1: Check if instruction triggers draft creation or active disambiguation
                const draftResult = await this.draftEngine.processExecutiveInstruction(message);
                if (draftResult.type === 'draft_staged' || draftResult.type === 'disambiguation_required') {
                    const assistantMsg = saveChatMessage('assistant', draftResult.replyText, 'tier2');
                    this.broadcast('CHAT_MESSAGE', assistantMsg);
                    if (draftResult.draft) {
                        this.broadcast('NEW_DRAFT', draftResult.draft);
                    }
                    return res.json({
                        reply: draftResult.replyText,
                        type: draftResult.type,
                        draft: draftResult.draft,
                        matches: draftResult.matches,
                        tier: 'tier2',
                        model: config.modelTier2Workhorse
                    });
                }
                if (draftResult.type === 'chat_reply' && draftResult.replyText) {
                    const assistantMsg = saveChatMessage('assistant', draftResult.replyText, 'tier1');
                    this.broadcast('CHAT_MESSAGE', assistantMsg);
                    return res.json({
                        reply: draftResult.replyText,
                        type: 'chat_reply',
                        tier: 'tier1',
                        model: config.modelTier1Router
                    });
                }
                // Step 2: Fall back to standard executive chat reasoning via Tier 2 Executive Flash
                const result = await aiRouter.executeTask('executive_chat', message);
                const assistantMsg = saveChatMessage('assistant', result.text, result.actualTier);
                this.broadcast('CHAT_MESSAGE', assistantMsg);
                res.json({
                    reply: result.text,
                    type: 'chat_reply',
                    tier: result.actualTier,
                    model: result.modelUsed
                });
            }
            catch (error) {
                console.error('Chat processing error:', error);
                res.status(500).json({ error: error.message || 'Failed to process executive chat message' });
            }
        });
        // 3. Two-Stage Draft Queue
        this.app.get('/api/drafts', (req, res) => {
            const drafts = getPendingDrafts();
            res.json({ drafts });
        });
        this.app.post('/api/drafts/:id/approve', async (req, res) => {
            const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const draftId = parseInt(paramId, 10);
            try {
                const result = await this.draftEngine.approveAndDispatch(draftId);
                this.broadcast('DRAFT_UPDATED', { id: draftId, status: 'sent' });
                res.json({ success: true, message: result.message });
            }
            catch (error) {
                res.status(500).json({ error: error.message || 'Failed to dispatch approved draft' });
            }
        });
        this.app.post('/api/drafts/:id/cancel', (req, res) => {
            const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const draftId = parseInt(paramId, 10);
            const reason = req.body?.reason || 'Cancelled by Cephas in Executive Cockpit';
            this.draftEngine.cancelDraft(draftId, reason);
            this.broadcast('DRAFT_UPDATED', { id: draftId, status: 'rejected' });
            res.json({ success: true, message: 'Draft rejected' });
        });
        this.app.put('/api/drafts/:id', (req, res) => {
            const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const draftId = parseInt(paramId, 10);
            const { text } = req.body;
            if (!text || typeof text !== 'string') {
                return res.status(400).json({ error: 'Text is required for draft update' });
            }
            this.draftEngine.editDraft(draftId, text);
            this.broadcast('DRAFT_UPDATED', { id: draftId, draft_text: text });
            res.json({ success: true, message: 'Draft updated' });
        });
        // 4. Contacts Address Book
        this.app.get('/api/contacts', (req, res) => {
            const query = req.query.q;
            if (query) {
                res.json({ contacts: searchContacts(query) });
            }
            else {
                res.json({ contacts: getAllContacts(100) });
            }
        });
        // 5. Habits
        this.app.get('/api/habits', (req, res) => {
            const today = req.query.date || new Date().toISOString().split('T')[0];
            res.json({ habits: getHabitsForDate(today) });
        });
        this.app.post('/api/habits/:key', (req, res) => {
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
        this.app.get('/api/meetings', (req, res) => {
            res.json({ meetings: getMeetingSessions(20) });
        });
        // Meeting Ear: Audio upload & ingestion
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const recDir = path.resolve(process.cwd(), './recordings');
                if (!fs.existsSync(recDir))
                    fs.mkdirSync(recDir, { recursive: true });
                cb(null, recDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = path.extname(file.originalname) || '.wav';
                cb(null, `meeting-${uniqueSuffix}${ext}`);
            }
        });
        const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
        this.app.post('/api/meetings/upload', upload.single('audio'), async (req, res) => {
            if (!req.file) {
                return res.status(400).json({ error: 'No audio file uploaded.' });
            }
            const { meetingEar } = await import('../services/meeting-ear.js');
            const titleHint = req.body?.title || 'Executive Meeting';
            try {
                const result = await meetingEar.processMeetingAudio(req.file.path, req.file.mimetype || 'audio/wav', titleHint);
                this.broadcast('NEW_MEETING', result);
                res.json({ success: true, meeting: result });
            }
            catch (err) {
                console.error('Meeting audio processing error:', err);
                res.status(500).json({ error: err.message || 'Failed to process meeting audio.' });
            }
        });
        // 7. Cephas Finance Tracker
        this.app.get('/api/finances', (req, res) => {
            const monthYear = req.query.month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const expenses = getExpensesForMonth(monthYear);
            res.json({ monthYear, expenses });
        });
        this.app.post('/api/finances', async (req, res) => {
            const { text, items } = req.body;
            const { financeTracker } = await import('../services/finance-tracker.js');
            if (items && Array.isArray(items)) {
                const result = await financeTracker.logExpenses(items);
                return res.json(result);
            }
            else if (text && typeof text === 'string') {
                const parsed = await financeTracker.parseExpenses(text);
                const result = await financeTracker.logExpenses(parsed);
                return res.json(result);
            }
            res.status(400).json({ error: 'Either "text" or "items" array is required.' });
        });
        this.app.get('/api/finances/weekly-report', async (req, res) => {
            const { financeTracker } = await import('../services/finance-tracker.js');
            const report = await financeTracker.generateWeeklyReport();
            res.json({ report });
        });
        // 8. One-Tap Google OAuth Consent & Callback
        this.app.get('/auth/google', async (req, res) => {
            if (!fs.existsSync(config.googleCredentialsPath)) {
                return res.status(400).send(`
          <div style="font-family: sans-serif; padding: 40px; background: #0b0f19; color: white;">
            <h2>Google Setup Required</h2>
            <p>Please place your Google OAuth Client ID file at <code>${config.googleCredentialsPath}</code>.</p>
          </div>
        `);
            }
            const raw = fs.readFileSync(config.googleCredentialsPath, 'utf-8');
            const creds = JSON.parse(raw);
            const clientInfo = creds.installed || creds.web;
            const { google } = await import('googleapis');
            const redirectUri = `http://${req.headers.host || 'localhost:4892'}/auth/google/callback`;
            const oAuth2Client = new google.auth.OAuth2(clientInfo.client_id, clientInfo.client_secret, redirectUri);
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/documents',
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/tasks',
                    'https://www.googleapis.com/auth/contacts'
                ]
            });
            res.redirect(authUrl);
        });
        this.app.get('/auth/google/callback', async (req, res) => {
            const code = req.query.code;
            if (!code)
                return res.status(400).send('No authorization code provided by Google.');
            try {
                const raw = fs.readFileSync(config.googleCredentialsPath, 'utf-8');
                const creds = JSON.parse(raw);
                const clientInfo = creds.installed || creds.web;
                const { google } = await import('googleapis');
                const redirectUri = `http://${req.headers.host || 'localhost:4892'}/auth/google/callback`;
                const oAuth2Client = new google.auth.OAuth2(clientInfo.client_id, clientInfo.client_secret, redirectUri);
                const { tokens } = await oAuth2Client.getToken(code);
                fs.writeFileSync(config.googleTokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
                res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0b0f19; color: white;">
              <h1 style="color: #4ade80;">🎉 Google Workspace Successfully Connected!</h1>
              <p>Zerubbabel now has access to your Google Drive, Docs, Sheets, Calendar, Tasks, and Contacts.</p>
              <p><a href="/" style="color: #60a5fa; text-decoration: underline;">Return to Zerubbabel Cockpit</a></p>
            </body>
          </html>
        `);
            }
            catch (err) {
                res.status(500).send(`Authentication failed: ${err.message}`);
            }
        });
    }
    listen(port, host) {
        return new Promise((resolve) => {
            this.server.listen(port, host, () => {
                console.log(`🌐 [ApiServer] Zerubbabel API listening on http://${host}:${port}`);
                console.log(`📡 [ApiServer] WebSocket Server active on ws://${host}:${port}`);
                resolve();
            });
        });
    }
}

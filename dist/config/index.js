import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
// Load .env
dotenv.config();
// Ensure required directories exist
const ensureDirectories = () => {
    const dirs = [
        './data',
        './auth/personal',
        './auth/bot',
        './recordings',
        './credentials',
        './logs'
    ];
    for (const dir of dirs) {
        const fullPath = path.resolve(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }
};
ensureDirectories();
export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4892', 10),
    host: process.env.HOST || '0.0.0.0',
    apiKey: process.env.API_KEY || 'zerub-secure-local-token',
    databasePath: process.env.DATABASE_PATH || './data/zerubbabel.db',
    // Executive Phone Identities
    cephasPersonalPhone: (process.env.CEPHAS_PERSONAL_PHONE || '2348072854186').replace(/\D/g, ''),
    zerubAssistantPhone: (process.env.ZERUB_ASSISTANT_PHONE || '2347051627659').replace(/\D/g, ''),
    assistantName: process.env.ASSISTANT_NAME || 'Zerubbabel',
    outboundSignature: process.env.OUTBOUND_SIGNATURE || '— Sent on behalf of Cephas by Zerubbabel (Executive Assistant)',
    // Auth Paths
    authDirPersonal: path.resolve(process.cwd(), process.env.AUTH_DIR_PERSONAL || './auth/personal'),
    authDirAssistant: path.resolve(process.cwd(), process.env.AUTH_DIR_ASSISTANT || './auth/bot'),
    // Gemini AI Engine
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    modelTier1Router: process.env.MODEL_TIER1_ROUTER || 'gemini-3.5-flash-lite',
    modelTier2Workhorse: process.env.MODEL_TIER2_WORKHORSE || 'gemini-3.8-flash',
    modelTier3Deep: process.env.MODEL_TIER3_DEEP || 'gemini-3.8-flash',
    // Google Workspace
    googleCredentialsPath: path.resolve(process.cwd(), process.env.GOOGLE_CREDENTIALS_PATH || './credentials/google-credentials.json'),
    googleTokenPath: path.resolve(process.cwd(), process.env.GOOGLE_TOKEN_PATH || './credentials/google-token.json'),
    googleDriveMeetingFolderName: process.env.GOOGLE_DRIVE_MEETING_FOLDER_NAME || 'Zerubbabel Meeting Summaries'
};

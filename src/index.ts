import { config } from './config/index.js';
import { getDatabase, setSetting } from './db/index.js';
import { WhatsAppSocketManager } from './whatsapp/socket-manager.js';
import { ApiServer } from './api/server.js';

console.log('================================================================');
console.log('🏛️  ZERUBBABEL — AUTONOMOUS AI EXECUTIVE ASSISTANT (CEPHAS EA)   ');
console.log('📱  100% Phone-Hosted Daemon (Samsung S20FE)                     ');
console.log('================================================================\n');

async function main() {
  try {
    // 1. Initialize SQLite Database
    console.log('📦 [1/4] Connecting to Local SQLite Database...');
    const db = getDatabase();
    setSetting('last_daemon_start', new Date().toISOString());
    console.log(`✅ [1/4] SQLite Database active at ${config.databasePath}`);

    // 2. Initialize WhatsApp Socket 1 (Personal Observer)
    console.log('📱 [2/4] Initializing Socket 1: Personal WhatsApp (+2348072854186)...');
    const personalSocket = new WhatsAppSocketManager(
      'personal_observer',
      config.cephasPersonalPhone,
      config.authDirPersonal
    );

    // 3. Initialize WhatsApp Socket 2 (Assistant SIM)
    console.log('🤖 [3/4] Initializing Socket 2: Assistant SIM (+2347051627659)...');
    const assistantSocket = new WhatsAppSocketManager(
      'assistant_dispatcher',
      config.zerubAssistantPhone,
      config.authDirAssistant
    );

    // 4. Start Local API & WebSocket Server
    console.log('🌐 [4/4] Starting Local Executive API & IPC Server...');
    const apiServer = new ApiServer(personalSocket, assistantSocket);
    await apiServer.listen(config.port, config.host);

    console.log('\n🟢 Zerubbabel Daemon successfully initialized and running.');
    console.log('👉 To pair Socket 1: npm run pair:personal');
    console.log('👉 To pair Socket 2: npm run pair:assistant\n');

    // Handle process signals for graceful teardown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down Zerubbabel Daemon...');
      await personalSocket.disconnect();
      await assistantSocket.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('❌ Fatal error during Zerubbabel bootstrap:', error);
    process.exit(1);
  }
}

main();

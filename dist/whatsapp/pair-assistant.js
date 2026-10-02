import { WhatsAppSocketManager } from './socket-manager.js';
import { config } from '../config/index.js';
console.log('====================================================');
console.log('📱 ZERUBBABEL PAIRING PROTOCOL — SOCKET 2 (ASSISTANT)');
console.log(`Target Phone: +${config.zerubAssistantPhone}`);
console.log('Mode: Independent Group Member & Outbound Dispatcher');
console.log('====================================================\n');
const manager = new WhatsAppSocketManager('assistant_dispatcher', config.zerubAssistantPhone, config.authDirAssistant);
manager.on('status', (s) => {
    console.log(`[Socket 2 Status] -> ${s.status}`);
    if (s.status === 'connected') {
        console.log('\n🎉 SUCCESS: Assistant SIM WhatsApp linked successfully!');
        console.log('Zerubbabel is now ready to join groups and dispatch approved messages.\n');
    }
});
// Check if user specified pairing code flag or QR default
const usePairingCode = process.argv.includes('--code');
manager.start(usePairingCode).catch(err => {
    console.error('Fatal pairing error:', err);
});

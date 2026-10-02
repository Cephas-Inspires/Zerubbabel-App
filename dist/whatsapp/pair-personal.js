import { WhatsAppSocketManager } from './socket-manager.js';
import { config } from '../config/index.js';
console.log('====================================================');
console.log('📱 ZERUBBABEL PAIRING PROTOCOL — SOCKET 1 (PERSONAL)');
console.log(`Target Phone: +${config.cephasPersonalPhone}`);
console.log('Mode: Linked Device (Observer / Contact Harvester)');
console.log('====================================================\n');
const manager = new WhatsAppSocketManager('personal_observer', config.cephasPersonalPhone, config.authDirPersonal);
manager.on('status', (s) => {
    console.log(`[Socket 1 Status] -> ${s.status}`);
    if (s.status === 'connected') {
        console.log('\n🎉 SUCCESS: Personal WhatsApp linked successfully!');
        console.log('Zerubbabel is now passively observing in the background.\n');
    }
});
// Check if user specified pairing code flag or QR default
const usePairingCode = process.argv.includes('--code');
manager.start(usePairingCode).catch(err => {
    console.error('Fatal pairing error:', err);
});

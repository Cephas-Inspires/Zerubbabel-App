import { DraftEngine } from './draft-engine.js';
import { aiRouter } from '../ai/router.js';
import { config } from '../config/index.js';
import { saveChatMessage, getPendingDrafts } from '../db/index.js';
export class PersonalAssistantChatService {
    assistantSocket;
    personalSocket;
    draftEngine;
    isProcessing = false;
    // Deduplicate messages processed within last 60 seconds
    processedMsgIds = new Set();
    constructor(assistantSocket, personalSocket) {
        this.assistantSocket = assistantSocket;
        this.personalSocket = personalSocket;
        this.draftEngine = new DraftEngine(assistantSocket);
        this.attachSockets();
    }
    attachSockets() {
        const handleEvent = async (event) => {
            if (event.isGroup)
                return;
            const rawId = event.rawMessageId || `${event.timestamp}-${event.messageText.substring(0, 10)}`;
            if (this.processedMsgIds.has(rawId)) {
                return; // Already processed by the other socket
            }
            const normalizedSender = (event.senderPhone || '').replace(/\D/g, '');
            const normalizedCephas = config.cephasPersonalPhone.replace(/\D/g, '');
            const normalizedAssistant = config.zerubAssistantPhone.replace(/\D/g, '');
            const remoteClean = (event.remoteJid || '').replace(/\D/g, '');
            // Detect if this message represents Cephas talking to Zerubbabel:
            // Case 1: Received on Assistant Socket from Cephas
            const isFromCephasOnAssistant = event.role === 'assistant_dispatcher' &&
                !event.fromMe &&
                (normalizedSender === normalizedCephas ||
                    normalizedSender.endsWith(normalizedCephas.slice(-10)) ||
                    event.senderJid.includes(normalizedCephas));
            // Case 2: Sent from Cephas's Personal Socket directed to Assistant SIM
            const isFromCephasOnPersonal = event.role === 'personal_observer' &&
                event.fromMe &&
                (remoteClean === normalizedAssistant ||
                    remoteClean.endsWith(normalizedAssistant.slice(-10)));
            if (!isFromCephasOnAssistant && !isFromCephasOnPersonal) {
                return;
            }
            // Mark message ID as processed
            this.processedMsgIds.add(rawId);
            setTimeout(() => this.processedMsgIds.delete(rawId), 60000);
            await this.handleCephasDirectMessage(event.messageText);
        };
        // Attach to Assistant Socket (Socket 2)
        this.assistantSocket.on('message', handleEvent);
        // Also attach to Personal Socket (Socket 1) for double-coverage!
        if (this.personalSocket) {
            this.personalSocket.on('message', handleEvent);
        }
    }
    /**
     * Handle Cephas chatting directly with Zerubbabel via WhatsApp
     */
    async handleCephasDirectMessage(messageText) {
        const trimmed = messageText.trim();
        if (!trimmed)
            return;
        console.log(`\n======================================================`);
        console.log(`💬 [WhatsApp EA Direct] Incoming directive from Cephas:`);
        console.log(`"${trimmed}"`);
        console.log(`======================================================\n`);
        // Save Cephas's incoming message
        saveChatMessage('user', trimmed);
        const cephasJid = `${config.cephasPersonalPhone}@s.whatsapp.net`;
        try {
            const lower = trimmed.toLowerCase();
            // 1. Quick Approval Command: "SEND", "YES", "APPROVE"
            if (lower === 'send' || lower === 'yes' || lower === 'approve' || lower === 'go ahead') {
                const pending = getPendingDrafts();
                if (pending.length > 0) {
                    const latest = pending[0];
                    await this.draftEngine.approveAndDispatch(latest.id);
                    const reply = `🚀 *Dispatched to ${latest.recipient_name || latest.recipient_phone}:*\n\n"${latest.draft_text}"\n\n— Zerubbabel`;
                    await this.assistantSocket.sendMessage(cephasJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
                else {
                    const reply = `ℹ️ Cephas, there are no pending drafts in the queue to send right now.`;
                    await this.assistantSocket.sendMessage(cephasJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
            }
            // 2. Quick Cancel Command: "CANCEL", "NO", "ABORT"
            if (lower === 'cancel' || lower === 'no' || lower === 'abort' || lower === 'dismiss') {
                const pending = getPendingDrafts();
                if (pending.length > 0) {
                    const latest = pending[0];
                    this.draftEngine.cancelDraft(latest.id, 'Cancelled via WhatsApp by Cephas');
                    const reply = `🗑️ *Cancelled draft for ${latest.recipient_name || latest.recipient_phone}.* It will not be sent.`;
                    await this.assistantSocket.sendMessage(cephasJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
            }
            // 3. Draft Engine / Intent Processing (Drafting messages, logging expenses, etc.)
            console.log(`🧠 [WhatsApp EA Direct] Evaluating executive intent...`);
            const draftResult = await this.draftEngine.processExecutiveInstruction(trimmed);
            if (draftResult.type === 'draft_staged' && draftResult.draft) {
                const reply = `📝 *Draft Staged for Review*\n\n` +
                    `👤 *To:* ${draftResult.draft.recipient_name || draftResult.draft.recipient_phone}\n` +
                    `💬 *Message:*\n"${draftResult.draft.draft_text}"\n\n` +
                    `👉 *Reply "SEND" to approve & dispatch*\n` +
                    `👉 *Reply "CANCEL" to abort*`;
                await this.assistantSocket.sendMessage(cephasJid, reply);
                saveChatMessage('assistant', reply, 'tier2');
                console.log(`✅ [WhatsApp EA Direct] Staged draft sent to Cephas for review.`);
                return;
            }
            if (draftResult.type === 'disambiguation_required') {
                await this.assistantSocket.sendMessage(cephasJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier2');
                return;
            }
            if (draftResult.type === 'chat_reply' && draftResult.replyText) {
                // Natural expense log or direct assistant reply
                await this.assistantSocket.sendMessage(cephasJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier1');
                console.log(`✅ [WhatsApp EA Direct] Replied to Cephas (Expense/Direct): ${draftResult.replyText}`);
                return;
            }
            // 4. Executive Reasoning & Strategic Chat (Cascading Multi-Model Engine)
            console.log(`🤖 [WhatsApp EA Direct] Synthesizing executive response via Multi-Model Engine...`);
            const aiResult = await aiRouter.executeTask('executive_chat', trimmed);
            const formattedReply = `${aiResult.text}\n\n_⚡ ${aiResult.modelUsed}_`;
            await this.assistantSocket.sendMessage(cephasJid, formattedReply);
            saveChatMessage('assistant', aiResult.text, aiResult.actualTier);
            console.log(`🚀 [WhatsApp EA Direct] Dispatched response to Cephas via ${aiResult.modelUsed}!`);
        }
        catch (err) {
            console.error('❌ Error handling Cephas direct WhatsApp message:', err);
            const errorMsg = `⚠️ Apologies Cephas, I encountered an issue processing that directive: ${err.message || err}`;
            await this.assistantSocket.sendMessage(cephasJid, errorMsg).catch(() => { });
        }
    }
}

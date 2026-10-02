import { DraftEngine } from './draft-engine.js';
import { aiRouter } from '../ai/router.js';
import { config } from '../config/index.js';
import { saveChatMessage, getPendingDrafts } from '../db/index.js';
export class PersonalAssistantChatService {
    assistantSocket;
    draftEngine;
    isProcessing = false;
    constructor(assistantSocket) {
        this.assistantSocket = assistantSocket;
        this.draftEngine = new DraftEngine(assistantSocket);
        this.attachSocket();
    }
    attachSocket() {
        this.assistantSocket.on('message', async (event) => {
            // We ONLY handle 1-on-1 direct messages sent from Cephas's Personal WhatsApp to Zerubbabel SIM
            if (event.isGroup)
                return;
            const normalizedSender = (event.senderPhone || '').replace(/\D/g, '');
            const normalizedCephas = config.cephasPersonalPhone.replace(/\D/g, '');
            if (normalizedSender !== normalizedCephas) {
                // If someone else DMs Zerubbabel directly, stranger screening handles it
                return;
            }
            await this.handleCephasDirectMessage(event.messageText);
        });
    }
    /**
     * Handle Cephas chatting directly with Zerubbabel via WhatsApp
     */
    async handleCephasDirectMessage(messageText) {
        if (this.isProcessing) {
            console.log('⏳ [WhatsApp EA] Already processing a previous directive from Cephas.');
        }
        const trimmed = messageText.trim();
        if (!trimmed)
            return;
        this.isProcessing = true;
        console.log(`\n💬 [WhatsApp Direct Chat] Cephas: "${trimmed}"`);
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
                    const result = await this.draftEngine.approveAndDispatch(latest.id);
                    const reply = `🚀 *Dispatched to ${latest.recipient_name || latest.recipient_phone}:*\n\n"${latest.draft_text}"\n\n— Zerubbabel`;
                    await this.assistantSocket.sendMessage(cephasJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    this.isProcessing = false;
                    return;
                }
                else {
                    const reply = `ℹ️ Cephas, there are no pending drafts in the queue to send right now.`;
                    await this.assistantSocket.sendMessage(cephasJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    this.isProcessing = false;
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
                    this.isProcessing = false;
                    return;
                }
            }
            // 3. Draft Engine / Intent Processing (Drafting messages, logging expenses, etc.)
            const draftResult = await this.draftEngine.processExecutiveInstruction(trimmed);
            if (draftResult.type === 'draft_staged' && draftResult.draft) {
                const reply = `📝 *Draft Staged for Review*\n\n` +
                    `👤 *To:* ${draftResult.draft.recipient_name || draftResult.draft.recipient_phone}\n` +
                    `💬 *Message:*\n"${draftResult.draft.draft_text}"\n\n` +
                    `👉 *Reply "SEND" to approve & dispatch*\n` +
                    `👉 *Reply "CANCEL" to abort*`;
                await this.assistantSocket.sendMessage(cephasJid, reply);
                saveChatMessage('assistant', reply, 'tier2');
                this.isProcessing = false;
                return;
            }
            if (draftResult.type === 'disambiguation_required') {
                await this.assistantSocket.sendMessage(cephasJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier2');
                this.isProcessing = false;
                return;
            }
            if (draftResult.type === 'chat_reply' && draftResult.replyText) {
                // Natural expense log or direct assistant reply
                await this.assistantSocket.sendMessage(cephasJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier1');
                this.isProcessing = false;
                return;
            }
            // 4. Executive Reasoning & Strategic Chat (Cascading Multi-Model Engine)
            const aiResult = await aiRouter.executeTask('executive_chat', trimmed);
            const formattedReply = `${aiResult.text}\n\n_⚡ ${aiResult.modelUsed}_`;
            await this.assistantSocket.sendMessage(cephasJid, formattedReply);
            saveChatMessage('assistant', aiResult.text, aiResult.actualTier);
        }
        catch (err) {
            console.error('❌ Error handling Cephas direct WhatsApp message:', err);
            const errorMsg = `⚠️ Apologies Cephas, I encountered an issue processing that instruction: ${err.message || err}`;
            await this.assistantSocket.sendMessage(cephasJid, errorMsg);
        }
        finally {
            this.isProcessing = false;
        }
    }
}

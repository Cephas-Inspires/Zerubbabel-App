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
            // 1. Ignore group chats in direct 1-on-1 assistant service
            if (event.isGroup)
                return;
            // 2. Ignore messages sent out by the assistant itself
            if (event.role === 'assistant_dispatcher' && event.fromMe) {
                return;
            }
            // 3. Determine if this message is for Zerubbabel:
            // Case A: ANY 1-on-1 incoming message to the Assistant Socket (Socket 2)
            // Since Socket 2 is Cephas's private Chief of Staff line, any incoming direct message is accepted.
            const isDirectToAssistant = event.role === 'assistant_dispatcher' && !event.fromMe;
            // Case B: Sent from Cephas's Personal Socket (Socket 1) directed to Assistant SIM
            const normalizedAssistant = config.zerubAssistantPhone.replace(/\D/g, '');
            const remoteClean = (event.remoteJid || '').replace(/\D/g, '');
            const isFromPersonalToAssistant = event.role === 'personal_observer' &&
                event.fromMe &&
                (remoteClean === normalizedAssistant ||
                    remoteClean.endsWith(normalizedAssistant.slice(-10)) ||
                    (event.remoteJid && event.remoteJid.includes(normalizedAssistant)));
            if (!isDirectToAssistant && !isFromPersonalToAssistant) {
                return;
            }
            // 4. Deduplicate across dual sockets
            const rawId = event.rawMessageId || `${event.timestamp}-${event.messageText.substring(0, 15)}`;
            if (this.processedMsgIds.has(rawId)) {
                return;
            }
            this.processedMsgIds.add(rawId);
            setTimeout(() => this.processedMsgIds.delete(rawId), 60000);
            // 5. Determine reply JID: reply directly back to sender thread, fallback to Cephas JID
            const replyJid = (event.role === 'assistant_dispatcher' && event.remoteJid)
                ? event.remoteJid
                : `${config.cephasPersonalPhone}@s.whatsapp.net`;
            await this.handleCephasDirectMessage(event.messageText, replyJid);
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
    async handleCephasDirectMessage(messageText, targetJid) {
        const trimmed = messageText.trim();
        if (!trimmed)
            return;
        const replyJid = targetJid || `${config.cephasPersonalPhone}@s.whatsapp.net`;
        console.log(`\n======================================================`);
        console.log(`📥 [WhatsApp EA Direct] Incoming directive from Cephas:`);
        console.log(`"${trimmed}" (thread: ${replyJid})`);
        console.log(`======================================================\n`);
        // Save Cephas's incoming message
        saveChatMessage('user', trimmed);
        try {
            const lower = trimmed.toLowerCase();
            // 1. Quick Approval Command: "SEND", "YES", "APPROVE"
            if (lower === 'send' || lower === 'yes' || lower === 'approve' || lower === 'go ahead') {
                const pending = getPendingDrafts();
                if (pending.length > 0) {
                    const latest = pending[0];
                    await this.draftEngine.approveAndDispatch(latest.id);
                    const reply = `🚀 *Dispatched to ${latest.recipient_name || latest.recipient_phone}:*\n\n"${latest.draft_text}"\n\n— Zerubbabel`;
                    await this.assistantSocket.sendMessage(replyJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
                else {
                    const reply = `ℹ️ Cephas, there are no pending drafts in the queue to send right now.`;
                    await this.assistantSocket.sendMessage(replyJid, reply);
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
                    await this.assistantSocket.sendMessage(replyJid, reply);
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
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier2');
                console.log(`✅ [WhatsApp EA Direct] Staged draft sent to Cephas for review.`);
                return;
            }
            if (draftResult.type === 'disambiguation_required') {
                await this.assistantSocket.sendMessage(replyJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier2');
                return;
            }
            if (draftResult.type === 'chat_reply' && draftResult.replyText) {
                // Natural expense log or direct assistant reply
                await this.assistantSocket.sendMessage(replyJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier1');
                console.log(`✅ [WhatsApp EA Direct] Replied to Cephas (Expense/Direct): ${draftResult.replyText}`);
                return;
            }
            // 4. Executive Reasoning & Strategic Chat (Cascading Multi-Model Engine)
            console.log(`🤖 [WhatsApp EA Direct] Synthesizing executive response via Gemini...`);
            const aiResult = await aiRouter.executeTask('executive_chat', trimmed);
            const formattedReply = `${aiResult.text}\n\n_⚡ ${aiResult.modelUsed}_`;
            await this.assistantSocket.sendMessage(replyJid, formattedReply);
            saveChatMessage('assistant', aiResult.text, aiResult.actualTier);
            console.log(`🚀 [WhatsApp EA Direct] Dispatched response to Cephas via ${aiResult.modelUsed}!`);
        }
        catch (err) {
            console.error('❌ Error handling Cephas direct WhatsApp message:', err);
            const errorMsg = `⚠️ Apologies Cephas, I encountered an issue processing that directive: ${err.message || err}`;
            await this.assistantSocket.sendMessage(replyJid, errorMsg).catch(() => { });
        }
    }
}

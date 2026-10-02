import { getRecentGroupMessages } from '../db/index.js';
import { aiRouter } from '../ai/router.js';
import { config } from '../config/index.js';
export class GroupIntelligenceService {
    assistantSocket = null;
    isProcessing = false;
    constructor(assistantSocket) {
        if (assistantSocket) {
            this.attachSocket(assistantSocket);
        }
    }
    attachSocket(socket) {
        this.assistantSocket = socket;
        this.assistantSocket.on('message', async (event) => {
            // Only process group messages where Zerubbabel is tagged
            if (event.isGroup && event.isZerubTagged && event.groupJid) {
                await this.handleTaggedGroupMessage(event);
            }
        });
    }
    /**
     * Main handler when Zerubbabel is tagged (@Zerub, @2347051627659, or Zerubbabel) in a group chat
     */
    async handleTaggedGroupMessage(event) {
        if (!event.groupJid)
            return '';
        const isCephas = event.senderPhone === config.cephasPersonalPhone;
        console.log(`\n💬 [Group Intelligence] Zerubbabel tagged in group: ${event.groupJid} by ${event.senderName || event.senderPhone} (Cephas: ${isCephas})`);
        // Fetch the rolling 30-message buffer
        const recentMessages = getRecentGroupMessages(event.groupJid, 30);
        // Format conversation history for AI reasoning
        const historyText = recentMessages.map((m) => {
            const timeStr = new Date(m.message_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const sender = m.sender_name || `+${m.sender_jid.replace(/@.*$/, '')}`;
            return `[${timeStr}] ${sender}: ${m.message_text}`;
        }).join('\n');
        // Build Contextual Prompt
        const prompt = `You are Zerubbabel, an AI Executive Assistant and Team Member participating directly in a WhatsApp group chat.
You have been tagged by ${event.senderName || 'a team member'} (+${event.senderPhone}).
Cephas (your Principal and Founder) is ${isCephas ? 'the one who tagged you' : 'a member of this group'}.

RECENT CONVERSATION HISTORY (Up to 30 messages):
---
${historyText || '[No prior history recorded yet]'}
---

TRIGGER MESSAGE:
"${event.messageText}"

OPERATING RULES:
1. Tone: Highly intelligent, concise, executive, practical, and helpful.
2. WhatsApp Formatting: Use standard WhatsApp markdown (*bold*, _italic_, bullet points with • or -).
3. Brevity: Keep responses concise (under 120 words) unless a comprehensive summary or action item list was explicitly requested.
4. Privacy: Do NOT leak Cephas's personal private notes, medical habits, or confidential credentials.
5. Attribution: If asked for a summary or deliverables, cite who agreed to what based on the conversation history.

Generate your direct group reply now.`;
        try {
            const response = await aiRouter.executeTask('group_reply', prompt, {
                temperature: 0.4
            });
            const replyText = response.text.trim();
            // Dispatch reply directly into the WhatsApp group via Socket 2
            if (this.assistantSocket) {
                console.log(`📤 [Group Intelligence] Dispatching contextual group reply to ${event.groupJid}...`);
                await this.assistantSocket.sendMessage(event.groupJid, replyText);
            }
            return replyText;
        }
        catch (error) {
            console.error(`❌ [Group Intelligence] Error generating group reply:`, error);
            const fallback = `I'm analyzing our discussion context. One moment while I review our deliverables.`;
            if (this.assistantSocket) {
                await this.assistantSocket.sendMessage(event.groupJid, fallback).catch(() => { });
            }
            return fallback;
        }
    }
    /**
     * Helper to manually test or simulate group reasoning
     */
    async simulateGroupMessage(groupJid, senderPhone, senderName, messageText) {
        const isTagged = messageText.toLowerCase().includes('@zerub') ||
            messageText.toLowerCase().includes('zerubbabel') ||
            messageText.includes(config.zerubAssistantPhone);
        const event = {
            role: 'assistant_dispatcher',
            senderJid: `${senderPhone}@s.whatsapp.net`,
            senderPhone,
            senderName,
            isGroup: true,
            groupJid,
            messageText,
            timestamp: Date.now(),
            isZerubTagged: isTagged,
            rawMessageId: `sim_${Date.now()}`
        };
        return this.handleTaggedGroupMessage(event);
    }
}

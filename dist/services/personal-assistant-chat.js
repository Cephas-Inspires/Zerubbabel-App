import { DraftEngine } from './draft-engine.js';
import { aiRouter } from '../ai/router.js';
import { config } from '../config/index.js';
import { GoogleWorkspaceTools } from '../google/workspace-tools.js';
import { saveChatMessage, getPendingDrafts, upsertHabitLog, saveSpiritualJournal, saveReadingNote, getSetting } from '../db/index.js';
import { financeTracker } from './finance-tracker.js';
export class PersonalAssistantChatService {
    assistantSocket;
    personalSocket;
    draftEngine;
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
            const today = new Date().toISOString().split('T')[0];
            // -----------------------------------------------------------------------
            // 1. Quick Approvals & Cancellations ("SEND", "YES", "CANCEL", "ABORT")
            // -----------------------------------------------------------------------
            if (lower === 'send' || lower === 'approve' || lower === 'go ahead') {
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
            // -----------------------------------------------------------------------
            // 2. Interactive Task Quick Commands ("Done 1", "Delete 2", "Add task ...")
            // -----------------------------------------------------------------------
            const doneMatch = trimmed.match(/^(?:done|complete)\s*(\d+)$/i);
            if (doneMatch) {
                const taskIndex = parseInt(doneMatch[1], 10);
                const rawTasks = getSetting('today_top_tasks');
                let taskTitle = `Task ${taskIndex}`;
                let taskId;
                if (rawTasks) {
                    try {
                        const parsedTasks = JSON.parse(rawTasks);
                        const found = parsedTasks.find((t) => t.index === taskIndex);
                        if (found) {
                            taskTitle = found.title;
                            taskId = found.id;
                        }
                    }
                    catch { }
                }
                if (taskId) {
                    await GoogleWorkspaceTools.completeTask(taskId);
                }
                const reply = `✅ *Task ${taskIndex} ("${taskTitle}") marked complete in Google Tasks!* 🎯`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            const deleteMatch = trimmed.match(/^(?:delete|remove|prune)\s*(\d+)$/i);
            if (deleteMatch) {
                const taskIndex = parseInt(deleteMatch[1], 10);
                const rawTasks = getSetting('today_top_tasks');
                let taskTitle = `Task ${taskIndex}`;
                let taskId;
                if (rawTasks) {
                    try {
                        const parsedTasks = JSON.parse(rawTasks);
                        const found = parsedTasks.find((t) => t.index === taskIndex);
                        if (found) {
                            taskTitle = found.title;
                            taskId = found.id;
                        }
                    }
                    catch { }
                }
                if (taskId) {
                    await GoogleWorkspaceTools.deleteTask(taskId);
                }
                const reply = `🗑️ *Task ${taskIndex} ("${taskTitle}") removed from Google Tasks.*`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            const addTaskMatch = trimmed.match(/^(?:add\s+task\s+|add\s+)(.+?)(?:\s+to\s+tasks)?$/i);
            if (addTaskMatch && (lower.includes('to task') || lower.startsWith('add task '))) {
                const newTitle = addTaskMatch[1].trim();
                if (newTitle) {
                    await GoogleWorkspaceTools.createTask(newTitle);
                    const reply = `✅ *Added "${newTitle}" to your Google Tasks!* 📋`;
                    await this.assistantSocket.sendMessage(replyJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
            }
            // -----------------------------------------------------------------------
            // 3. Physical Replenishment Sentry ("Yes", "Eating now", "Snooze 30")
            // -----------------------------------------------------------------------
            if (lower === 'eating now' || lower === 'had lunch' || (lower === 'yes' && !getPendingDrafts().length)) {
                upsertHabitLog('physical_replenishment', 'Midday Lunch', today, 'completed', 'Confirmed lunch & hydration');
                const reply = `🥗 *Excellent, Cephas.* Hydration and food replenish executive focus. Ready for the afternoon stretch!`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            if (lower === 'snooze 30' || lower === 'snooze') {
                upsertHabitLog('physical_replenishment', 'Midday Lunch', today, 'snoozed', 'Snoozed 30 mins');
                const reply = `⏳ *Understood.* Snoozed for 30 minutes. I will check back in with you at 1:30 PM.`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                setTimeout(async () => {
                    try {
                        await this.assistantSocket.sendMessage(replyJid, '🥗 *Checking back in, Cephas!* Grab your lunch and step away for a quick break.');
                    }
                    catch { }
                }, 30 * 60 * 1000);
                return;
            }
            // -----------------------------------------------------------------------
            // 4. Fitness & Movement Sentry ("Done", "Going now", "Rest day")
            // -----------------------------------------------------------------------
            if (lower === 'going now' || lower === 'workout done' || lower === 'gym done' || lower === 'working out' || (lower === 'done' && !doneMatch)) {
                upsertHabitLog('fitness_workout', 'Evening Workout', today, 'completed', 'Physical movement completed');
                const reply = `🏋️ *Workout logged!* Physical discipline fuels mental endurance. High output requires high energy. 💪`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            if (lower === 'rest day' || lower === 'resting today' || lower === 'active recovery') {
                upsertHabitLog('fitness_workout', 'Evening Workout', today, 'rest_day', 'Active recovery day');
                const reply = `🧘 *Active recovery logged.* Rest well tonight!`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            // -----------------------------------------------------------------------
            // 5. Spiritual Grounding — Deep Contextual Dialogue (08:30 AM Routine)
            // -----------------------------------------------------------------------
            const biblePattern = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|psalms|proverb|proverbs|ecclesiastes|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s*\d*/i;
            if (biblePattern.test(trimmed)) {
                console.log(`📖 [WhatsApp EA Direct] Theological contextual dialogue triggered for: "${trimmed}"`);
                const prompt = `You are Zerubbabel, Chief of Staff to Cephas. Cephas is sharing his morning Scripture study: "${trimmed}".
Provide a high-level theological and strategic reflection:
1. Identify the specific passage/chapter and quote 1-2 anchor verses with impact.
2. Connect the spiritual principle directly to high-stakes leadership, faith, discernment, and strategic execution.
3. Formulate one sharp, penetrating question asking where Cephas needs discernment between human planning and divine alignment today.
4. Keep the tone dignified, wise, and articulate.
5. End with the exact note: "(Logged ${trimmed} into your Spiritual Journal ✍️)"`;
                const aiResult = await aiRouter.executeTask('executive_chat', prompt, { temperature: 0.3 });
                const reply = aiResult.text.trim();
                saveSpiritualJournal(today, trimmed, 'Theological Grounding', reply);
                upsertHabitLog('spiritual_grounding', 'Spiritual Grounding', today, 'completed', trimmed);
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier2');
                return;
            }
            // -----------------------------------------------------------------------
            // 6. Mental Mastery — Strategic Reading Dialogue (03:30 PM Routine)
            // -----------------------------------------------------------------------
            const bookPattern = /\b(zero to one|good to great|atomic habits|deep work|principles|lean startup|thinking fast|chapter\s*\d+|reading\b|book\b)/i;
            if (bookPattern.test(trimmed) && (lower.includes('chapter') || lower.includes('by ') || lower.includes('thiel') || lower.includes('collins') || lower.includes('reading'))) {
                console.log(`📚 [WhatsApp EA Direct] Mental Mastery reading dialogue triggered for: "${trimmed}"`);
                const prompt = `You are Zerubbabel, Chief of Staff to Cephas. Cephas is sharing his daily intellectual reading: "${trimmed}".
Provide a strategic business & conceptual discussion:
1. Identify the core thesis or paradox of the chapter/book.
2. Relate it directly to positioning, competitive moat, business strategy, or venture building.
3. Formulate one sharp, practical question on how Cephas is applying this concept to his ventures right now.
4. End with: "(Logged ${trimmed} to your Reading Knowledge Bank 🧠)"`;
                const aiResult = await aiRouter.executeTask('executive_chat', prompt, { temperature: 0.4 });
                const reply = aiResult.text.trim();
                saveReadingNote(today, trimmed, null, 'Strategic Framework', reply);
                upsertHabitLog('mental_mastery', 'Book Reading', today, 'completed', trimmed);
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier2');
                return;
            }
            // -----------------------------------------------------------------------
            // 7. Cephas Finance Tracker — Natural Expense Logging (08:00 PM Routine)
            // -----------------------------------------------------------------------
            const isExpenseLikely = lower.includes('spent') ||
                lower.includes('expense') ||
                lower.includes('paid ') ||
                lower.includes('bought') ||
                lower.includes('cost') ||
                /\b\d+k\b/i.test(trimmed) ||
                /\b₦\d+/i.test(trimmed);
            if (isExpenseLikely) {
                console.log(`💳 [WhatsApp EA Direct] Parsing potential expense entry: "${trimmed}"`);
                const parsedExpenses = await financeTracker.parseExpenses(trimmed);
                if (parsedExpenses.length > 0) {
                    const logResult = await financeTracker.logExpenses(parsedExpenses);
                    upsertHabitLog('daily_expense_checkin', 'Finance Check-in', today, 'completed', `${parsedExpenses.length} items logged`);
                    await this.assistantSocket.sendMessage(replyJid, logResult.summaryText);
                    saveChatMessage('assistant', logResult.summaryText, 'tier1');
                    return;
                }
            }
            // -----------------------------------------------------------------------
            // 8. Draft Engine / Intent Processing (Drafting messages to contacts)
            // -----------------------------------------------------------------------
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
                await this.assistantSocket.sendMessage(replyJid, draftResult.replyText);
                saveChatMessage('assistant', draftResult.replyText, 'tier1');
                console.log(`✅ [WhatsApp EA Direct] Replied to Cephas: ${draftResult.replyText}`);
                return;
            }
            // -----------------------------------------------------------------------
            // 9. Executive Reasoning & Strategic Chat (Cascading Gemini Engine)
            // -----------------------------------------------------------------------
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

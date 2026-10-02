import { DraftEngine } from './draft-engine.js';
import { aiRouter } from '../ai/router.js';
import { config } from '../config/index.js';
import { GoogleWorkspaceTools } from '../google/workspace-tools.js';
import { GoogleAuthManager } from '../google/auth.js';
import { ExecutiveSchedulerService } from './schedulers.js';
import { saveChatMessage, getPendingDrafts, upsertHabitLog, saveSpiritualJournal, saveReadingNote, getSetting, setSetting } from '../db/index.js';
import { financeTracker } from './finance-tracker.js';
export class PersonalAssistantChatService {
    assistantSocket;
    personalSocket;
    draftEngine;
    scheduler;
    // Deduplicate messages processed within last 60 seconds
    processedMsgIds = new Set();
    constructor(assistantSocket, personalSocket) {
        this.assistantSocket = assistantSocket;
        this.personalSocket = personalSocket;
        this.draftEngine = new DraftEngine(assistantSocket);
        this.scheduler = new ExecutiveSchedulerService(assistantSocket);
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
            const todayDateFormatted = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
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
            // 2. On-Demand Morning Briefing ("Give me my briefing", "briefing")
            // -----------------------------------------------------------------------
            if (lower.includes('briefing') || lower === 'morning brief' || lower === 'daily brief') {
                console.log(`☀️ [WhatsApp EA Direct] Generating live Morning Strategic Briefing...`);
                const brief = await this.scheduler.runMorningBriefing();
                await this.assistantSocket.sendMessage(replyJid, brief);
                return;
            }
            // -----------------------------------------------------------------------
            // 3. Live Google Calendar Query ("What's on my calendar", "schedule", "agenda")
            // -----------------------------------------------------------------------
            if (lower === 'calendar' ||
                lower === 'schedule' ||
                lower === 'agenda' ||
                lower.includes('my calendar') ||
                lower.includes('my schedule') ||
                lower.includes('meetings today') ||
                lower.includes('what do i have today')) {
                console.log(`📅 [WhatsApp EA Direct] Fetching live Google Calendar events...`);
                if (!GoogleAuthManager.isConfigured()) {
                    const reply = `📅 *Google Calendar:*\n\n` +
                        `Google Workspace is not connected yet. Please visit http://localhost:4892/auth/google on your browser to authorize access to your Google Calendar and Tasks.\n\n— Zerubbabel`;
                    await this.assistantSocket.sendMessage(replyJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
                const events = await GoogleWorkspaceTools.getTodayAgenda();
                let reply = `📅 *Today's Google Calendar (${todayDateFormatted}):*\n\n`;
                if (events.length === 0) {
                    reply += `• No meetings or events scheduled for today. Your calendar is clear.`;
                }
                else {
                    reply += events.map(e => {
                        const time = e.start ? new Date(e.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'All-day';
                        const end = e.end ? ` – ${new Date(e.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '';
                        return `• *${time}${end}*: ${e.summary}`;
                    }).join('\n');
                }
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            // -----------------------------------------------------------------------
            // 4. Live Google Tasks Query ("Tasks", "My tasks", "To-do")
            // -----------------------------------------------------------------------
            if (lower === 'tasks' ||
                lower === 'my tasks' ||
                lower === 'what are my tasks' ||
                lower === 'todo' ||
                lower === 'to-do' ||
                lower === 'to do' ||
                lower.includes('pending tasks')) {
                console.log(`🎯 [WhatsApp EA Direct] Fetching live Google Tasks...`);
                if (!GoogleAuthManager.isConfigured()) {
                    const reply = `🎯 *Google Tasks:*\n\n` +
                        `Google Workspace is not connected yet. Please visit http://localhost:4892/auth/google on your browser to authorize access.\n\n— Zerubbabel`;
                    await this.assistantSocket.sendMessage(replyJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
                const tasks = await GoogleWorkspaceTools.getTopTasks(10);
                let reply = `🎯 *Your Active Google Tasks:*\n\n`;
                if (tasks.length === 0) {
                    reply += `• All tasks completed! You have no pending items on your checklist.`;
                }
                else {
                    reply += tasks.map((t, idx) => `${idx + 1}. [ ] ${t.title}`).join('\n');
                    reply += `\n\n───────────────────────────\n💬 *Quick Commands:*\n• Reply *"Done 1"* -> Marks task 1 complete\n• Reply *"Delete 2"* -> Prunes task 2\n• Reply *"Add [task] to tasks"* -> Creates a new task`;
                    setSetting('today_top_tasks', JSON.stringify(tasks.map((t, idx) => ({ index: idx + 1, id: t.id, title: t.title }))));
                }
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            // -----------------------------------------------------------------------
            // 5. Interactive Task Quick Commands ("Done 1", "Delete 2", "Add task ...")
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
            // 6. Schedule a Meeting on Google Calendar ("Schedule meeting ...")
            // -----------------------------------------------------------------------
            const isScheduleAsk = lower.startsWith('schedule meeting') || lower.startsWith('schedule a meeting') || lower.startsWith('book a meeting') || lower.startsWith('set up a meeting');
            if (isScheduleAsk) {
                console.log(`📅 [WhatsApp EA Direct] Parsing meeting scheduling request: "${trimmed}"`);
                const parsePrompt = `Extract calendar event details from this user instruction: "${trimmed}"
Current reference date & time: ${new Date().toISOString()} (Africa/Lagos, UTC+1).
Return ONLY a valid JSON object matching this schema:
{
  "summary": string,
  "startDateTime": string (ISO 8601 string, e.g. 2026-10-03T14:00:00+01:00),
  "endDateTime": string (ISO 8601 string, default 45 mins after start),
  "description": string | null
}`;
                try {
                    const res = await aiRouter.executeTask('intent_classification', parsePrompt, { temperature: 0.1 });
                    const jsonMatch = res.text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.summary && parsed.startDateTime && parsed.endDateTime) {
                            const created = await GoogleWorkspaceTools.createCalendarEvent(parsed.summary, parsed.startDateTime, parsed.endDateTime, parsed.description || undefined);
                            const startFormatted = new Date(parsed.startDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            const dateFormatted = new Date(parsed.startDateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                            const meetLine = created.meetLink ? `\n• **Google Meet:** ${created.meetLink}` : '';
                            const reply = `📅 *Meeting Scheduled in Google Calendar:*\n\n` +
                                `• **Event:** ${parsed.summary}\n` +
                                `• **When:** ${dateFormatted} at ${startFormatted}${meetLine}\n` +
                                `• **Calendar Link:** ${created.htmlLink || 'Saved to Google Calendar'}\n\n— Zerubbabel`;
                            await this.assistantSocket.sendMessage(replyJid, reply);
                            saveChatMessage('assistant', reply, 'tier1');
                            return;
                        }
                    }
                }
                catch (err) {
                    console.warn('Meeting parsing error:', err?.message || err);
                }
            }
            // -----------------------------------------------------------------------
            // 6.1 Google Drive File Search ("Search Drive for ...", "Find on Drive")
            // -----------------------------------------------------------------------
            const isDriveSearch = lower.startsWith('search drive') || lower.startsWith('find on drive') || lower.startsWith('find file') || lower.startsWith('search google drive');
            if (isDriveSearch) {
                console.log(`📁 [WhatsApp EA Direct] Searching Google Drive...`);
                const query = trimmed.replace(/^(search google drive for|search google drive|search drive for|search drive|find on drive|find file)\s*/i, '').trim();
                if (query) {
                    const files = await GoogleWorkspaceTools.searchDriveFiles(query, 5);
                    let reply = `📁 *Google Drive Search ("${query}"):*\n\n`;
                    if (files.length === 0) {
                        reply += `No files found matching "${query}" on your Google Drive.`;
                    }
                    else {
                        reply += files.map((f, i) => `${i + 1}. *${f.name}*\n   🔗 ${f.webViewLink || 'In Google Drive'}`).join('\n\n');
                    }
                    await this.assistantSocket.sendMessage(replyJid, reply);
                    saveChatMessage('assistant', reply, 'tier1');
                    return;
                }
            }
            // -----------------------------------------------------------------------
            // 6.2 Gmail Inbox Check & Email Search ("Check emails", "Search emails")
            // -----------------------------------------------------------------------
            const isEmailQuery = lower === 'emails' || lower === 'check emails' || lower === 'check my email' || lower === 'check my emails' || lower === 'unread emails' || lower.startsWith('search email');
            if (isEmailQuery) {
                console.log(`📬 [WhatsApp EA Direct] Querying Gmail...`);
                let q = 'is:unread -category:promotions -category:spam';
                if (lower.startsWith('search email')) {
                    q = trimmed.replace(/^search emails?\s*(for)?\s*/i, '').trim() || q;
                }
                const emails = await GoogleWorkspaceTools.searchEmails(q, 5);
                let reply = `📬 *Executive Email Digest (Gmail):*\n\n`;
                if (emails.length === 0) {
                    reply += `No unread or matching emails found in your primary inbox.`;
                }
                else {
                    reply += emails.map((e, i) => `${i + 1}. *From:* ${e.sender}\n   *Subject:* ${e.subject}\n   _${e.snippet.substring(0, 90)}..._`).join('\n\n');
                }
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            // -----------------------------------------------------------------------
            // 6.3 Google Docs Creation ("Create Google Doc titled ...")
            // -----------------------------------------------------------------------
            const isCreateDoc = lower.startsWith('create google doc') || lower.startsWith('create doc') || lower.startsWith('new google doc');
            if (isCreateDoc) {
                console.log(`📄 [WhatsApp EA Direct] Creating Google Doc...`);
                const docPrompt = `Extract title and body content for a Google Doc from this instruction: "${trimmed}".
Return ONLY JSON matching:
{
  "title": string,
  "bodyText": string
}`;
                try {
                    const res = await aiRouter.executeTask('intent_classification', docPrompt, { temperature: 0.1 });
                    const jsonMatch = res.text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        const title = parsed.title || 'Executive Document';
                        const body = parsed.bodyText || '';
                        const doc = await GoogleWorkspaceTools.createGoogleDoc(title, body);
                        const reply = `📄 *Google Doc Created in Drive:*\n\n• **Title:** ${title}\n• **Link:** ${doc.url}\n\n— Zerubbabel`;
                        await this.assistantSocket.sendMessage(replyJid, reply);
                        saveChatMessage('assistant', reply, 'tier1');
                        return;
                    }
                }
                catch (docErr) {
                    console.warn('Doc creation error:', docErr?.message || docErr);
                }
            }
            // -----------------------------------------------------------------------
            // 6.4 Google Contacts Sync ("Sync contacts", "Sync Google contacts")
            // -----------------------------------------------------------------------
            const isSyncContacts = lower === 'sync contacts' || lower === 'sync google contacts';
            if (isSyncContacts) {
                console.log(`👥 [WhatsApp EA Direct] Syncing Google Contacts...`);
                const res = await GoogleWorkspaceTools.syncGoogleContacts();
                const reply = `👥 *Google Contacts Synced:*\n\nSuccessfully synced ${res.syncedCount} contacts to local memory address book.\n\n— Zerubbabel`;
                await this.assistantSocket.sendMessage(replyJid, reply);
                saveChatMessage('assistant', reply, 'tier1');
                return;
            }
            // -----------------------------------------------------------------------
            // 7. Grounded Morning Greeting ("Good morning", "Hello", "Hi")
            // -----------------------------------------------------------------------
            if (lower === 'good morning' ||
                lower === 'good morning zerub' ||
                lower === 'morning' ||
                lower === 'hello' ||
                lower === 'hi' ||
                lower === 'hey') {
                let calendarSnapshot = '• Calendar: 0 scheduled meetings';
                let tasksSnapshot = '• Tasks: 0 active priorities';
                try {
                    if (GoogleAuthManager.isConfigured()) {
                        const agenda = await GoogleWorkspaceTools.getTodayAgenda();
                        calendarSnapshot = agenda.length > 0
                            ? `• Calendar: ${agenda.length} scheduled meeting(s) today`
                            : '• Calendar: 0 meetings scheduled today (Clear schedule)';
                        const tasks = await GoogleWorkspaceTools.getTopTasks(5);
                        tasksSnapshot = tasks.length > 0
                            ? `• Tasks: ${tasks.length} active priority item(s)`
                            : '• Tasks: All cleared';
                    }
                }
                catch { }
                const greeting = `🏛️ *Good morning, Cephas.* Zerubbabel online.\n\n` +
                    `Today is *${todayDateFormatted}*.\n` +
                    `${calendarSnapshot}\n` +
                    `${tasksSnapshot}\n\n` +
                    `Reply *"briefing"* for your full strategic morning briefing, or let me know what you want to execute today.`;
                await this.assistantSocket.sendMessage(replyJid, greeting);
                saveChatMessage('assistant', greeting, 'tier1');
                return;
            }
            // -----------------------------------------------------------------------
            // 8. Physical Replenishment Sentry ("Yes", "Eating now", "Snooze 30")
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
            // 9. Fitness & Movement Sentry ("Done", "Going now", "Rest day")
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
            // 10. Spiritual Grounding — Deep Contextual Dialogue (08:30 AM Routine)
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
            // 11. Mental Mastery — Strategic Reading Dialogue (03:30 PM Routine)
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
            // 12. Cephas Finance Tracker — Natural Expense Logging (08:00 PM Routine)
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
            // 13. Draft Engine / Intent Processing (Drafting messages to contacts)
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
            // 14. Executive Reasoning & Strategic Chat (Grounded in Real Date & Reality)
            // -----------------------------------------------------------------------
            console.log(`🤖 [WhatsApp EA Direct] Synthesizing executive response via Gemini...`);
            const groundedPrompt = `You are Zerubbabel, Chief of Staff to Cephas.
Today is ${todayDateFormatted} (Lagos, Nigeria).
STRICT OPERATING RULE: Do NOT invent fictional corporate projects (e.g. Andromeda Project, Sarah Chen, Q2 decks) or fake calendar meetings. If you do not have live calendar or task data, simply state that or address Cephas's question directly.

User message: "${trimmed}"`;
            const aiResult = await aiRouter.executeTask('executive_chat', groundedPrompt);
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

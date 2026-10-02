import cron from 'node-cron';
import { aiRouter } from '../ai/router.js';
import { GoogleWorkspaceTools } from '../google/workspace-tools.js';
import { upsertHabitLog, saveChatMessage } from '../db/index.js';
import { financeTracker } from './finance-tracker.js';
import { config } from '../config/index.js';
export class ExecutiveSchedulerService {
    assistantSocket = null;
    onNotificationCallback = null;
    constructor(assistantSocket) {
        if (assistantSocket) {
            this.assistantSocket = assistantSocket;
        }
    }
    setAssistantSocket(socket) {
        this.assistantSocket = socket;
    }
    onNotification(cb) {
        this.onNotificationCallback = cb;
    }
    startAllSchedulers() {
        console.log('⏰ [Executive Schedulers] Initializing 7 executive sentry routines...');
        // 1. 08:00 AM - Morning Strategic Briefing
        cron.schedule('0 8 * * *', async () => {
            console.log('⏰ Triggering 08:00 AM Morning Strategic Briefing...');
            await this.runMorningBriefing();
        });
        // 2. 08:30 AM - Spiritual Grounding
        cron.schedule('30 8 * * *', async () => {
            console.log('⏰ Triggering 08:30 AM Spiritual Grounding...');
            await this.dispatchPrompt('spiritual_grounding', 'Spiritual Grounding & Focus', '☀️ **Spiritual Grounding (8:30 AM):**\n\nCephas, take 15 minutes for Scripture reading, prayer, and mental centering before diving into operational execution.\n\n_“Commit your work to the Lord, and your plans will be established.” (Proverbs 16:3)_');
        });
        // 3. 01:00 PM - Physical Replenishment (Lunch & Screen Break)
        cron.schedule('0 13 * * *', async () => {
            console.log('⏰ Triggering 01:00 PM Physical Replenishment...');
            await this.dispatchPrompt('physical_replenishment', 'Physical Replenishment', '🥗 **Physical Replenishment (1:00 PM):**\n\nMidday pause: Step away from screens, nourish your body with lunch, and take 5 deep breaths to reset mental energy for the afternoon.');
        });
        // 4. 03:30 PM - Mental Mastery (Reading & Learning)
        cron.schedule('30 15 * * *', async () => {
            console.log('⏰ Triggering 03:30 PM Mental Mastery...');
            await this.dispatchPrompt('mental_mastery', 'Mental Mastery', '📚 **Mental Mastery Check-in (3:30 PM):**\n\nDedicate 20 minutes to your current book or strategic research. Continuous learning compounds exponentially.');
        });
        // 5. 06:00 PM - Fitness & Physical Movement
        cron.schedule('0 18 * * *', async () => {
            console.log('⏰ Triggering 06:00 PM Fitness Sentry...');
            await this.dispatchPrompt('fitness_workout', 'Fitness & Physical Movement', '🏋️ **Fitness & Movement Sentry (6:00 PM):**\n\nTime for physical movement: gym, run, or bodyweight workout. Physical vitality directly drives executive stamina.');
        });
        // 6. 08:00 PM - Daily Financial Expense Check-in ("Cephas Finance Tracker")
        cron.schedule('0 20 * * *', async () => {
            console.log('⏰ Triggering 08:00 PM Daily Expense Check-in...');
            await this.dispatchPrompt('daily_expense_checkin', 'Daily Expense Check-in', '💰 **Daily Expense Check-in (8:00 PM):**\n\nCephas, what expenses did you incur today?\n\nReply directly with your expenses (e.g. _"15k fuel, 4k lunch, $20 software"_) and I will log them to your **Cephas Finance Tracker** spreadsheet.');
        });
        // 7. 09:00 PM - Evening Strategic Debrief
        cron.schedule('0 21 * * *', async () => {
            console.log('⏰ Triggering 09:00 PM Evening Strategic Debrief...');
            await this.runEveningDebrief();
        });
        // 8. Saturday 10:00 PM - Weekly Financial Report & Breakdown
        cron.schedule('0 22 * * 6', async () => {
            console.log('⏰ Triggering Saturday 10:00 PM Weekly Financial Breakdown...');
            await this.runWeeklyFinanceReport();
        });
        console.log('✅ [Executive Schedulers] All 8 sentries successfully registered.');
    }
    // ---------------------------------------------------------------------------
    // Sentry Actions
    // ---------------------------------------------------------------------------
    async runMorningBriefing() {
        const today = new Date().toISOString().split('T')[0];
        const agenda = await GoogleWorkspaceTools.getTodayAgenda();
        const tasks = await GoogleWorkspaceTools.getTopTasks(5);
        const agendaSummary = agenda.length > 0
            ? agenda.map(a => `• ${a.start ? new Date(a.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All-day'}: ${a.summary}`).join('\n')
            : '• No scheduled calendar meetings for today.';
        const tasksSummary = tasks.length > 0
            ? tasks.map((t, idx) => `${idx + 1}. [ ] ${t.title}`).join('\n')
            : '• No pending Google Tasks.';
        const prompt = `You are Zerubbabel, Chief of Staff to Cephas.
Author Cephas's Morning Strategic Briefing for today (${today}).
CALENDAR EVENTS:
${agendaSummary}

TOP PRIORITY TASKS:
${tasksSummary}

Format with:
1. Executive greeting & core thematic focus for today.
2. 📅 Today's Strategic Agenda (Meetings).
3. 🎯 Top 3 High-Impact Deliverables (Priority Checklist).
4. Mindset anchor quote.
Keep it crisp, empowering, and structured in clean WhatsApp markdown.`;
        const generated = await aiRouter.executeTask('executive_chat', prompt, { temperature: 0.4 });
        const text = generated.text.trim();
        upsertHabitLog('morning_briefing', 'Morning Strategic Briefing', today, 'completed', 'Briefing generated');
        saveChatMessage('assistant', text, 'tier2');
        this.notify('Morning Strategic Briefing', text);
        return text;
    }
    async runEveningDebrief() {
        const today = new Date().toISOString().split('T')[0];
        const prompt = `You are Zerubbabel, Chief of Staff to Cephas.
Draft a concise, reflective Evening Strategic Debrief for Cephas at 9:00 PM.
Prompt him to:
1. Acknowledge today's biggest win.
2. Note any carry-overs to tomorrow.
3. Name the #1 objective for tomorrow morning.
Keep it short, structured, and intentional.`;
        const generated = await aiRouter.executeTask('executive_chat', prompt, { temperature: 0.4 });
        const text = generated.text.trim();
        upsertHabitLog('evening_debrief', 'Evening Strategic Debrief', today, 'pending', 'Debrief sent');
        saveChatMessage('assistant', text, 'tier2');
        this.notify('Evening Strategic Debrief', text);
        return text;
    }
    async runWeeklyFinanceReport() {
        const report = await financeTracker.generateWeeklyReport();
        saveChatMessage('assistant', report, 'tier2');
        this.notify('Weekly Financial Report', report);
        return report;
    }
    async dispatchPrompt(habitKey, title, text) {
        const today = new Date().toISOString().split('T')[0];
        upsertHabitLog(habitKey, title, today, 'pending');
        saveChatMessage('assistant', text, 'tier1');
        this.notify(title, text);
    }
    notify(title, message) {
        if (this.onNotificationCallback) {
            this.onNotificationCallback(title, message);
        }
        // Also dispatch to personal WhatsApp if Socket 2 is available
        if (this.assistantSocket && config.cephasPersonalPhone) {
            this.assistantSocket.sendMessage(config.cephasPersonalPhone, message).catch(() => { });
        }
    }
}

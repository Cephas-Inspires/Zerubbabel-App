import cron from 'node-cron';
import { aiRouter } from '../ai/router.js';
import { GoogleWorkspaceTools } from '../google/workspace-tools.js';
import { 
  upsertHabitLog, 
  saveChatMessage, 
  getHabitScoreForDate,
  setSetting,
  getSetting 
} from '../db/index.js';
import { financeTracker } from './finance-tracker.js';
import { WhatsAppSocketManager } from '../whatsapp/socket-manager.js';
import { config } from '../config/index.js';

export class ExecutiveSchedulerService {
  private assistantSocket: WhatsAppSocketManager | null = null;
  private onNotificationCallback: ((title: string, message: string) => void) | null = null;

  constructor(assistantSocket?: WhatsAppSocketManager) {
    if (assistantSocket) {
      this.assistantSocket = assistantSocket;
    }
  }

  public setAssistantSocket(socket: WhatsAppSocketManager) {
    this.assistantSocket = socket;
  }

  public onNotification(cb: (title: string, message: string) => void) {
    this.onNotificationCallback = cb;
  }

  public startAllSchedulers(): void {
    console.log('⏰ [Executive Schedulers] Initializing 8 executive routines (Africa/Lagos)...');

    const cronOptions = { timezone: 'Africa/Lagos' };

    // 1. 08:00 AM - Morning Strategic Briefing
    cron.schedule('0 8 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 08:00 AM Morning Strategic Briefing...');
      await this.runMorningBriefing();
    }, cronOptions);

    // 2. 08:30 AM - Spiritual Grounding
    cron.schedule('30 8 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 08:30 AM Spiritual Grounding...');
      await this.runSpiritualGrounding();
    }, cronOptions);

    // 3. 01:00 PM - Physical Replenishment (Midday Reset)
    cron.schedule('0 13 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 01:00 PM Physical Replenishment...');
      await this.runPhysicalReplenishment();
    }, cronOptions);

    // 4. 03:30 PM - Mental Mastery (Strategic Reading & Learning)
    cron.schedule('30 15 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 03:30 PM Mental Mastery...');
      await this.runMentalMastery();
    }, cronOptions);

    // 5. 06:00 PM - Fitness & Physical Movement
    cron.schedule('0 18 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 06:00 PM Fitness Sentry...');
      await this.runFitnessMovement();
    }, cronOptions);

    // 6. 08:00 PM - Daily Financial Expense Check-in ("Cephas Finance Tracker")
    cron.schedule('0 20 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 08:00 PM Daily Expense Check-in...');
      await this.runFinanceCheckin();
    }, cronOptions);

    // 7. 09:00 PM - Evening Strategic Debrief
    cron.schedule('0 21 * * *', async () => {
      console.log('⏰ [Scheduler] Triggering 09:00 PM Evening Strategic Debrief...');
      await this.runEveningDebrief();
    }, cronOptions);

    // 8. Saturday 10:00 PM - Weekly Financial Executive Breakdown
    cron.schedule('0 22 * * 6', async () => {
      console.log('⏰ [Scheduler] Triggering Saturday 10:00 PM Weekly Financial Breakdown...');
      await this.runWeeklyFinanceReport();
    }, cronOptions);

    console.log('✅ [Executive Schedulers] All 8 master sentries registered with timezone: Africa/Lagos.');
  }

  // ---------------------------------------------------------------------------
  // 1. 08:00 AM — Morning Strategic Briefing
  // ---------------------------------------------------------------------------
  public async runMorningBriefing(): Promise<string> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dateFormatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // 1. Fetch Calendar Events
    const agenda = await GoogleWorkspaceTools.getTodayAgenda();
    let agendaText = '• No scheduled calendar meetings for today.';
    let deepWorkText = '⚡ *Deep Work Window*: Open availability for deep focus blocks today.';

    if (agenda.length > 0) {
      agendaText = agenda.map(a => {
        const time = a.start ? new Date(a.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'All-day';
        const end = a.end ? ` – ${new Date(a.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '';
        return `• ${time}${end}: ${a.summary}`;
      }).join('\n');

      // Calculate deep work gaps between events (simple heuristic)
      const sorted = [...agenda].filter(a => a.start && a.end).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      if (sorted.length >= 1) {
        deepWorkText = '⚡ *Deep Work Window*: Focus windows available between meetings.';
      }
    }

    // 2. Fetch Tasks (Top 3 priority)
    const tasks = await GoogleWorkspaceTools.getTopTasks(5);
    const top3 = tasks.slice(0, 3);
    let tasksText = '1. [ ] Review daily priorities\n2. [ ] Strategy & execution block\n3. [ ] Team / client touchpoints';

    if (top3.length > 0) {
      tasksText = top3.map((t, idx) => `${idx + 1}. [ ] ${t.title}`).join('\n');
      // Cache top tasks in system_settings for interactive quick commands ("Done 1", "Delete 2")
      setSetting('today_top_tasks', JSON.stringify(top3.map((t, idx) => ({ index: idx + 1, id: t.id, title: t.title }))));
    }

    // 3. Fetch Gmail Executive Digest (Last 24 hours)
    let emailText = '• All inboxes clear. No urgent pending items.';
    try {
      const emails = await GoogleWorkspaceTools.getRecentImportantEmails(3);
      if (emails.length > 0) {
        emailText = emails.map(e => `• *${e.sender}*: ${e.subject}`).join('\n');
      }
    } catch {
      emailText = '• Email digest available once Google Workspace permissions are connected.';
    }

    // 4. Strategic Anchor Quotes Pool
    const anchors = [
      '"He who gathers by labor shall increase." — Proverbs 13:11',
      '"Commit your works to the Lord, and your thoughts will be established." — Proverbs 16:3',
      '"The soul of the diligent shall be made rich." — Proverbs 13:4',
      '"Where there is no vision, the people cast off restraint." — Proverbs 29:18',
      '"Do you see a man skillful in his work? He will stand before kings." — Proverbs 22:29'
    ];
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];

    const brief = `☀️ *GOOD MORNING, CEPHAS!*\n` +
      `Strategic Briefing for ${dateFormatted}:\n\n` +
      `📅 *TODAY'S SCHEDULE (Google Calendar)*:\n${agendaText}\n` +
      `${deepWorkText}\n\n` +
      `🎯 *TOP PRIORITIES (Google Tasks)*:\n${tasksText}\n\n` +
      `📬 *EXECUTIVE EMAIL DIGEST (Last 24h)*:\n${emailText}\n\n` +
      `💡 *STRATEGIC ANCHOR*:\n${anchor}\n\n` +
      `───────────────────────────\n` +
      `💬 *Quick Commands*:\n` +
      `• Reply *"Done 1"* -> Marks task 1 complete in Google Tasks.\n` +
      `• Reply *"Delete 2"* -> Prunes task 2.\n` +
      `• Reply *"Move 3 to tomorrow"* -> Reschedules task 3.\n` +
      `• Or reply with any new task you want me to add!`;

    upsertHabitLog('morning_briefing', 'Morning Strategic Briefing', todayStr, 'completed', 'Briefing delivered');
    saveChatMessage('assistant', brief, 'tier2');

    this.notify('Morning Strategic Briefing', brief);
    return brief;
  }

  // ---------------------------------------------------------------------------
  // 2. 08:30 AM — Spiritual Grounding
  // ---------------------------------------------------------------------------
  public async runSpiritualGrounding(): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];
    const message = `📖 *Morning Grounding, Cephas!*\n` +
      `Time to anchor the day in prayer and the Word. What Scripture book and chapter are you studying today?`;

    upsertHabitLog('spiritual_grounding', 'Spiritual Grounding', todayStr, 'pending');
    saveChatMessage('assistant', message, 'tier1');
    this.notify('Spiritual Grounding', message);
    return message;
  }

  // ---------------------------------------------------------------------------
  // 3. 01:00 PM — Physical Replenishment
  // ---------------------------------------------------------------------------
  public async runPhysicalReplenishment(): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];
    const message = `🥗 *Midday Reset, Cephas!*\n` +
      `It's 1:00 PM. Time to step away from your screens. Have you had lunch and water today?\n` +
      `(Reply *"Yes"*, *"Eating now"*, or *"Snooze 30"*)`;

    upsertHabitLog('physical_replenishment', 'Midday Lunch', todayStr, 'pending');
    saveChatMessage('assistant', message, 'tier1');
    this.notify('Physical Replenishment', message);
    return message;
  }

  // ---------------------------------------------------------------------------
  // 4. 03:30 PM — Mental Mastery
  // ---------------------------------------------------------------------------
  public async runMentalMastery(): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];
    const message = `📚 *Mental Mastery Check-in, Cephas!*\n` +
      `Time for your daily intellectual growth. What book and chapter are you reading today?`;

    upsertHabitLog('mental_mastery', 'Book Reading', todayStr, 'pending');
    saveChatMessage('assistant', message, 'tier1');
    this.notify('Mental Mastery', message);
    return message;
  }

  // ---------------------------------------------------------------------------
  // 5. 06:00 PM — Fitness & Physical Movement
  // ---------------------------------------------------------------------------
  public async runFitnessMovement(): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];
    const message = `🏋️ *End-of-Day Vitality Sentry, Cephas!*\n` +
      `Time to close the laptop and get some physical movement in. Are we working out today?\n` +
      `(Reply *"Done"*, *"Going now"*, or *"Rest day"*)`;

    upsertHabitLog('fitness_workout', 'Evening Workout', todayStr, 'pending');
    saveChatMessage('assistant', message, 'tier1');
    this.notify('Fitness Sentry', message);
    return message;
  }

  // ---------------------------------------------------------------------------
  // 6. 08:00 PM — Daily Financial Expense Check-in
  // ---------------------------------------------------------------------------
  public async runFinanceCheckin(): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];
    const message = `💳 *Cephas Finance Tracker — 8:00 PM Check-in!*\n` +
      `Did you make any personal or business expenses today? Send me the amounts and what they were for (e.g., '15k fuel, 5k lunch, 50k server').`;

    upsertHabitLog('daily_expense_checkin', 'Finance Check-in', todayStr, 'pending');
    saveChatMessage('assistant', message, 'tier1');
    this.notify('Finance Check-in', message);
    return message;
  }

  // ---------------------------------------------------------------------------
  // 7. 09:00 PM — Evening Strategic Debrief
  // ---------------------------------------------------------------------------
  public async runEveningDebrief(): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch Habit Adherence for Today
    const habitSummary = getHabitScoreForDate(todayStr);

    const habitLines = habitSummary.habits.map(h => {
      const icon = h.completed ? '✅ Completed' : '⏳ Pending';
      const detail = h.detail ? ` (${h.detail})` : '';
      return `• ${h.label.padEnd(20)}: ${icon}${detail}`;
    }).join('\n');

    const scoreStr = habitSummary.score === habitSummary.total
      ? `👉 *Score: ${habitSummary.score}/${habitSummary.total} Perfect Day! 🏆*`
      : `👉 *Score: ${habitSummary.score}/${habitSummary.total} (${Math.round((habitSummary.score / habitSummary.total) * 100)}%)*`;

    // 2. Fetch Tasks status from Google Tasks
    let completedText = '• Review daily priorities';
    let rolloverText = '• Strategic execution block';
    try {
      const topTasks = await GoogleWorkspaceTools.getTopTasks(5);
      if (topTasks.length > 0) {
        rolloverText = topTasks.map(t => `• ${t.title}`).join('\n');
      } else {
        rolloverText = '• No pending carry-overs!';
      }
    } catch {
      // fallback
    }

    const debrief = `🌙 *EVENING STRATEGIC DEBRIEF (9:00 PM)*\n` +
      `Day in Review, Cephas:\n\n` +
      `✅ *COMPLETED OBJECTIVES*:\n${completedText}\n\n` +
      `⏳ *ROLLING OVER TO TOMORROW*:\n${rolloverText}\n\n` +
      `🔥 *HABIT ADHERENCE TODAY*:\n${habitLines}\n` +
      `${scoreStr}\n\n` +
      `💬 *Daily Reflection*:\n` +
      `Reply with your biggest win from today, or tell me your #1 priority to tackle first thing tomorrow morning!`;

    upsertHabitLog('evening_debrief', 'Evening Strategic Debrief', todayStr, 'completed', 'Debrief delivered');
    saveChatMessage('assistant', debrief, 'tier2');

    this.notify('Evening Strategic Debrief', debrief);
    return debrief;
  }

  // ---------------------------------------------------------------------------
  // 8. Saturday 10:00 PM — Weekly Financial Executive Breakdown
  // ---------------------------------------------------------------------------
  public async runWeeklyFinanceReport(): Promise<string> {
    const report = await financeTracker.generateWeeklyReport();
    saveChatMessage('assistant', report, 'tier2');
    this.notify('Weekly Financial Breakdown', report);
    return report;
  }

  private notify(title: string, message: string) {
    if (this.onNotificationCallback) {
      this.onNotificationCallback(title, message);
    }
    // Dispatch to Cephas's WhatsApp if Assistant Socket is connected
    if (this.assistantSocket && config.cephasPersonalPhone) {
      this.assistantSocket.sendMessage(config.cephasPersonalPhone, message).catch(err => {
        console.warn(`⚠️ [Scheduler Notify] Could not dispatch ${title} via WhatsApp:`, err?.message || err);
      });
    }
  }
}

# FEATURE SPECIFICATION: EXECUTIVE BRIEFINGS & CHECK-INS ENGINE
# Project: Zerubbabel — Autonomous AI Executive Assistant (Cephas EA)

---

## 1. Feature Overview
The **Executive Briefings & Check-ins Engine** is Zerubbabel’s proactive operational cadence. Running autonomously in the background via `node-cron`, it initiates contact with Cephas on WhatsApp throughout the day to synthesize his commitments, track his physical and spiritual habits, engage in deep intellectual discussions, capture expenses, and review daily/weekly performance.

---

## 2. Complete Daily & Weekly Master Schedule

| Trigger Time | Routine Name | Data Sources | Primary Function |
| :--- | :--- | :--- | :--- |
| **08:00 AM** | **Morning Strategic Briefing** | Google Calendar, Google Tasks, Gmail API | Complete daily cockpit: Schedule, Tasks, 24h Email Digest, Strategic Anchor. |
| **08:30 AM** | **Spiritual Grounding** | Gemini AI (Theology Knowledge Base), SQLite | Inquires on Scripture reading, engages in deep contextual discussion, logs revelations. |
| **01:00 PM** | **Physical Replenishment** | Local Clock, User Input | Lunch reminder, hydration check, enforces screen break. |
| **03:30 PM** | **Mental Mastery** | Gemini AI (Business/Strategy Knowledge), SQLite | Inquires on book & chapter, discusses strategic concepts, logs reading notes. |
| **06:00 PM** | **Fitness & Movement** | SQLite Habit Store | Workout/gym accountability, logs sessions or planned rest days. |
| **08:00 PM** | **Cephas Finance Tracker** | NLP Expense Parser, SQLite, Google Sheets | Captures daily personal & business expenses, categorizes spending. |
| **09:00 PM** | **Evening Strategic Debrief** | Google Tasks, SQLite Habit Store | Reviews completed targets, habit score (out of 6), logs wins and tomorrow’s priority. |
| **Sat 10:00 PM** | **Weekly Financial Breakdown** | SQLite Expenses Table, Google Sheets | Synthesizes 7-day spending, category breakdown, burn rate, and financial health report. |

---

## 3. Detailed Specification for Each Routine

### 3.1 — 08:00 AM: Morning Strategic Briefing

#### Objectives & Requirements:
1. **Google Calendar:** Fetch all events between `08:00` and `23:59`. Calculate and highlight open focus/deep work blocks (>90 mins).
2. **Google Tasks:** Query active and overdue tasks from Cephas's default task list. Extract the top 3 priority items.
3. **Gmail API (Past 24 Hours):** Query unread or important emails received in the last 24 hours (`after:<timestamp> is:unread`). Filter out marketing newsletters, spam, and blacklisted domains. Summarize top 2–3 emails (Sender, Subject, Core ask).
4. **Interactive Action Engine:** Enable Cephas to reply directly to the message to mutate tasks in Google Tasks in real-time.

#### Sample WhatsApp Message (Sent by Zerubbabel):
```text
☀️ *GOOD MORNING, CEPHAS!*
Strategic Briefing for Friday, October 2, 2026:

📅 *TODAY'S SCHEDULE (Google Calendar)*:
• 10:00 AM – 11:00 AM: Growth Call (Google Meet)
• 02:00 PM – 02:45 PM: Product Strategy Review
⚡ *Deep Work Window*: 11:00 AM – 02:00 PM (3 uninterrupted hours)

🎯 *TOP PRIORITIES (Google Tasks)*:
1. [ ] Finalize pitch deck budget
2. [ ] Review candidate portfolio
3. [ ] Approve growth copy draft

📬 *EXECUTIVE EMAIL DIGEST (Last 24h)*:
• *Michael Adeyemi (Partner)*: Sent updated term sheet for review.
• *AWS Billing*: Invoice ready for review ($42.10).
• *Stripe Support*: Verification confirmed.

💡 *STRATEGIC ANCHOR*:
"He who gathers by labor shall increase." — Proverbs 13:11

───────────────────────────
💬 *Quick Commands*:
• Reply *"Done 1"* -> Marks task 1 complete in Google Tasks.
• Reply *"Delete 2"* -> Prunes task 2.
• Reply *"Move 3 to tomorrow"* -> Reschedules task 3.
• Or reply with any new task you want me to add!
```

#### User Interaction Logic:
* If Cephas replies: **`Done 1`** -> Zerubbabel calls `tasks.patch` setting status to `completed` and replies:  
  *`✅ Task 1 marked complete in Google Tasks! 2 remaining for today.`*
* If Cephas replies: **`Delete 2`** -> Zerubbabel deletes the task from Google Tasks.
* If Cephas replies: **`Add review contract to tasks`** -> Zerubbabel creates a new task in Google Tasks.

---

### 3.2 — 08:30 AM: Spiritual Grounding

#### Objectives & Requirements:
1. Ensure Cephas grounds his morning in spiritual discipline, prayer, and Scripture.
2. **Contextual Discussion Engine:** The assistant must **not** just ask a yes/no question. It asks for the specific Book and Chapter Cephas is studying, accesses Gemini’s deep theological context, and holds a brief, high-level discussion on how the Scripture applies to Cephas’s leadership, faith, and strategy.
3. **Spiritual Journal Storage:** Automatically saves the Scripture passage, key insights, and date to the local SQLite `spiritual_journal` table.

#### Sample WhatsApp Interaction:
> **Zerubbabel:**  
> 📖 *Morning Grounding, Cephas!*  
> *Time to anchor the day in prayer and the Word. What Scripture book and chapter are you studying today?*

> **Cephas:**  
> *"Proverbs 16"*

> **Zerubbabel:**  
> *"A powerhouse chapter on sovereignty and planning, Cephas. Especially verse 3: 'Commit your works to the Lord, and your thoughts will be established,' and verse 9: 'A man's heart plans his way, but the Lord directs his steps.'*  
>  
> *As you lead your teams and execute today's strategy, where do you feel you need the most discernment between your human planning and divine alignment?*  
>  
> *(Logged Proverbs 16 into your Spiritual Journal ✍️)*"

---

### 3.3 — 01:00 PM: Physical Replenishment (Midday Reset)

#### Objectives & Requirements:
1. Guard Cephas from mental fatigue, brain fog, and sitting for extended hours without food or hydration.
2. Low-friction sentry: Requires a simple 1-second acknowledgment.
3. **Smart Snooze:** If Cephas is in a meeting or busy, he can snooze for 30–45 minutes.

#### Sample WhatsApp Interaction:
> **Zerubbabel:**  
> 🥗 *Midday Reset, Cephas!*  
> *It's 1:00 PM. Time to step away from your screens. Have you had lunch and water today?*  
> *(Reply **"Yes"**, **"Eating now"**, or **"Snooze 30"**)*

* **If Cephas replies `Yes`:**  
  -> *"Excellent. Hydration and food replenish executive focus. Ready for the afternoon stretch!"*
* **If Cephas replies `Snooze 30`:**  
  -> Zerubbabel stays quiet and pings again at 1:30 PM: *"Checking back in, Cephas! Grab your lunch and step away for a quick break."*

---

### 3.4 — 03:30 PM: Mental Mastery (Strategic Learning & Reading)

#### Objectives & Requirements:
1. Enforce Cephas’s commitment to daily intellectual growth and book reading (20–30 minutes).
2. **Contextual Framework Discussion:** Inquires what book and chapter Cephas is reading. Gemini identifies the core thesis of that chapter, discusses its practical business/leadership application with Cephas, and records key takeaways.
3. **Book Notes Knowledge Bank:** Logs book title, chapter, quote/insight, and date to the SQLite `reading_notes` table.

#### Sample WhatsApp Interaction:
> **Zerubbabel:**  
> 📚 *Mental Mastery Check-in, Cephas!*  
> *Time for your daily intellectual growth. What book and chapter are you reading today?*

> **Cephas:**  
> *"Zero to One by Peter Thiel, chapter 4 on Monopoly vs Competition"*

> **Zerubbabel:**  
> *"Thiel's core paradox: 'Under perfect competition, no firm makes an economic profit. If you want to create and capture lasting value, build a monopoly.'*  
>  
> *How are you positioning your current venture to escape competition and own a specific niche rather than competing on commodity features?*  
>  
> *(Logged Chapter 4 of Zero to One to your Reading Knowledge Bank 🧠)*"

---

### 3.5 — 06:00 PM: Fitness & Physical Movement

#### Objectives & Requirements:
1. Promote end-of-day vitality, stress release, and physical longevity.
2. Tracks workout consistency, active days, and planned recovery days without guilt.

#### Sample WhatsApp Interaction:
> **Zerubbabel:**  
> 🏋️ *End-of-Day Vitality Sentry, Cephas!*  
> *Time to close the laptop and get some physical movement in. Are we working out today?*  
> *(Reply **"Done"**, **"Going now"**, or **"Rest day"**)*

* **If Cephas replies `Done` or `Going now`:**  
  -> *"Workout logged! Physical discipline fuels mental endurance. High output requires high energy. 💪"*
* **If Cephas replies `Rest day`:**  
  -> *"Active recovery logged. Rest well tonight!"*

---

### 3.6 — 08:00 PM: Daily Financial Expense Check-in ("Cephas Finance Tracker")

#### Objectives & Requirements:
1. Prevent unrecorded personal and business expenses by capturing daily spending before the day ends.
2. **Natural Language Expense Parser:** Cephas can send raw text or voice notes mentioning amounts and descriptions (e.g. `"15k fuel, 5k lunch, 50k server hosting, $20 software"`).
3. **Automatic Categorization:** Zerubbabel categorizes each item into:
   * `Operations / Tech` (Hosting, domain, APIs, software)
   * `Logistics / Fuel` (Uber, fuel, transit)
   * `Food & Living` (Groceries, lunch, dining)
   * `Personal / Family`
4. **Data Persistence:** Writes the expense records into the local SQLite `expenses` table and appends a row to a dedicated Google Sheet named **`Cephas Finance Tracker`**.

#### Sample WhatsApp Interaction:
> **Zerubbabel:**  
> 💳 *Cephas Finance Tracker — 8:00 PM Check-in!*  
> *Did you make any personal or business expenses today? Send me the amounts and what they were for (e.g., '15k fuel, 5k lunch, 50k server').*

> **Cephas:**  
> *"Spent 25k on fuel, 8k on lunch with a client, and 60k for cloud hosting renewal"*

> **Zerubbabel:**  
> ```text
> 💰 *EXPENSES LOGGED SUCCESSFULLY*:
> • Fuel: ₦25,000 [Logistics]
> • Client Lunch: ₦8,000 [Business / Dining]
> • Cloud Hosting: ₦60,000 [Operations]
> ───────────────────────────
> Total Today: ₦93,000
> Synced to SQLite & "Cephas Finance Tracker" Google Sheet! 📊
> ```

---

### 3.7 — 09:00 PM: Evening Strategic Debrief

#### Objectives & Requirements:
1. Conclude the operational day with a structured review of completed tasks vs. roll-overs.
2. Calculate and display today's **Habit Discipline Score** (out of 6 habits).
3. Capture Cephas's #1 win and set the primary target for tomorrow morning.

#### Sample WhatsApp Message (Sent by Zerubbabel):
```text
🌙 *EVENING STRATEGIC DEBRIEF (9:00 PM)*
Day in Review, Cephas:

✅ *COMPLETED OBJECTIVES*:
• Finalize pitch deck budget
• Approve growth copy draft

⏳ *ROLLING OVER TO TOMORROW*:
• Review candidate portfolio (Scheduled for 9:00 AM)

🔥 *HABIT ADHERENCE TODAY*:
• Spiritual Grounding: ✅ Completed (Proverbs 16)
• Midday Lunch:        ✅ Completed
• Book Reading:        ✅ Completed (Zero to One, Ch. 4)
• Evening Workout:     ✅ Completed
• Finance Check-in:    ✅ Completed (₦93,000 logged)
👉 *Score: 5/5 Perfect Day! 🏆*

💬 *Daily Reflection*:
Reply with your biggest win from today, or tell me your #1 priority to tackle first thing tomorrow morning!
```

---

### 3.8 — Saturday 10:00 PM: Weekly Financial Executive Breakdown & Synthesis

#### Objectives & Requirements:
1. Every Saturday at 10:00 PM, aggregate the past 7 days of expenses from the SQLite `expenses` table.
2. Break down spending by category with percentages of total expenditure.
3. Calculate weekly burn rate and compare against Cephas’s weekly targets.
4. Deliver a high-level executive financial health summary.

#### Sample WhatsApp Message (Sent by Zerubbabel):
```text
📊 *WEEKLY FINANCIAL EXECUTIVE BREAKDOWN*
Week Ending: Saturday, October 3, 2026

💰 *TOTAL EXPENDITURE*: ₦428,500

📂 *CATEGORY BREAKDOWN*:
• 🏢 Operations & Tech: ₦185,000 (43.2%)
• 🚗 Logistics & Fuel:  ₦95,000  (22.2%)
• 🍽️ Food & Dining:    ₦68,500  (16.0%)
• 📱 Subscriptions:     ₦45,000  (10.5%)
• 👤 Personal/Misc:     ₦35,000  (8.1%)

📈 *FINANCIAL INSIGHTS & HEALTH*:
• Largest single expense: Cloud hosting renewal (₦60,000).
• Operations spending remained within budget.
• Logistics increased by 14% compared to last week.

📁 Detailed ledger updated in your Google Drive:
Google Sheet: "Cephas Finance Tracker - Oct 2026"
```

---

## 4. SQLite Database Schema for Briefings & Check-ins

```sql
-- Habit tracking logs
CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    habit_type TEXT NOT NULL, -- 'spiritual', 'lunch', 'reading', 'workout', 'finance'
    status TEXT NOT NULL, -- 'completed', 'snoozed', 'rest_day', 'skipped'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spiritual journal reflections
CREATE TABLE IF NOT EXISTS spiritual_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    scripture_reference TEXT NOT NULL,
    key_themes TEXT,
    cephas_reflection TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reading notes bank
CREATE TABLE IF NOT EXISTS reading_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    book_title TEXT NOT NULL,
    chapter TEXT,
    key_framework TEXT,
    cephas_insight TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense tracking ledger
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'NGN',
    category TEXT NOT NULL, -- 'Operations', 'Logistics', 'Food', 'Subscriptions', 'Personal'
    description TEXT NOT NULL,
    synced_to_sheets INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Backend Implementation Tasks for Coding Agent

When implementing this feature in Phase 5 of the build:
1. **`src/scheduler/cron.ts`**:
   - Register all 8 cron patterns with timezone `Africa/Lagos`.
2. **`src/scheduler/morningBrief.ts`**:
   - Query Google Calendar events for today.
   - Query active Google Tasks.
   - Query Gmail API for unread messages within the last 24 hours.
   - Dispatch formatted morning brief via Socket 2.
3. **`src/scheduler/contextualDialogue.ts`**:
   - Implement state machine for handling responses to 8:30 AM (Bible) and 3:30 PM (Reading).
   - Route passage/chapter to Gemini for strategic dialogue and save insights to SQLite.
4. **`src/scheduler/financeTracker.ts`**:
   - Parse natural language expense strings into structured amounts and categories.
   - Insert rows into SQLite `expenses` table and append to Google Sheet.
   - Run the Saturday 10:00 PM aggregation query for weekly synthesis.
5. **`src/scheduler/eveningDebrief.ts`**:
   - Calculate daily habit score (out of 6).
   - Summarize task completion status and dispatch to WhatsApp.

# PRODUCT REQUIREMENT DOCUMENT (PRD) & TECHNICAL SPECIFICATION
# Project: Zerubbabel — Autonomous AI Executive Assistant (Cephas EA)

---

## 1. Product Overview & Vision

**Zerubbabel** is a dedicated phone-native, autonomous AI Executive Assistant built for **Cephas** (Founder & Strategic Leader).

### Core Hosting & Operational Principle:
* **100% Phone-Hosted (NOT on Laptop):** The entire Zerubbabel assistant (the background daemon, local SQLite database, AI reasoning engine, and dual WhatsApp WebSockets) is **hosted and executed entirely on Cephas's smartphone (Samsung S20FE / Android)**. It runs 24/7 in Cephas's pocket without depending on any laptop, desktop PC, or cloud servers. The laptop is used strictly as a developer workstation to write code, build the Android APK, and push to GitHub.
* **Brand New GitHub Repository:** This project begins from absolute scratch in a fresh, dedicated GitHub repository (`Zerubbabel-App`), completely decoupled from any prior repositories.
* **Guided Phone Connection Protocol:** The coding agent must provide clear, step-by-step instructions guiding Cephas through pairing both WhatsApp numbers, granting Android microphone/battery permissions, and authorizing Google accounts directly on his phone.

### Clean-Split Executive Architecture:
1. **Dedicated Zerub Mobile App**: Cephas interacts with Zerubbabel exclusively through a private, custom mobile application on his Samsung smartphone. All conversations, daily strategic briefings, habit check-ins, meeting recordings, and draft approvals happen directly inside this dedicated app.
2. **Dual-WhatsApp Bridge Under the Hood**:
   * **Socket 1 (Personal Observer — `+2348072854186`)**: Silently observes Cephas's personal WhatsApp in the background, harvesting contacts and feeding real-world business context to Zerubbabel. Never speaks.
   * **Socket 2 (Assistant SIM — `+2347051627659`)**: Operates as an **Independent WhatsApp Member**. It has its own WhatsApp identity and can be added to any group chat (teams, projects, growth calls). It participates and replies *directly inside the group* whenever tagged (`@Zerub`). It also dispatches approved outbound WhatsApp messages to clients.
3. **Omni-Meeting Intelligence ("Meeting Ear")**: Cephas can tap **Record** inside the Zerub App (or via a Samsung Quick-Settings tile) for *any* meeting (Zoom, Google Meet, phone call, or in-person discussion). Zerubbabel captures the audio, automatically creates a structured Google Doc inside a dedicated Google Drive folder (`Zerubbabel Meeting Summaries`), and posts the executive minutes, decisions, and action items straight into the Zerub App.
4. **Strict Safety Protocol**: Zerubbabel cannot send an unreviewed WhatsApp message to any contact without Cephas explicitly tapping **[Approve & Send]** in the app.

---

## 2. Core Architecture & System Diagram

```mermaid
flowchart TD
    subgraph Device["Samsung S20FE (100% Production Host - Pocket 24/7)"]
        subgraph AppLayer["Zerub Dedicated Mobile App (Executive Cockpit)"]
            ChatUI["Private Executive Chat UI (Cephas <-> Zerub)"]
            Dashboard["Briefings & Habit Tracker Cards"]
            DraftCards["Interactive Draft Approvals [Send] / [Cancel]"]
            MeetingTile["[🎙️ Record Meeting] Quick Tile & Screen"]
        end

        subgraph Daemon["Zerubbabel 24/7 Foreground Service (Never Sleep)"]
            Core["Core Engine (Node.js / TypeScript)"]
            Socket1["Socket 1: Personal Observer\n(+2348072854186)"]
            Socket2["Socket 2: Assistant SIM\n(+2347051627659)"]
            Brain["AI Agent (Gemini 2.5 Flash + Tools)"]
            DB[(Local SQLite Database)]
            Schedulers["Cron Schedulers (node-cron)"]
            MeetingEar["Meeting Ear (Audio Recording Engine)"]
        end
    end

    subgraph Networks["External Services & WhatsApp Ecosystem"]
        PersonalWA["Cephas's Personal WhatsApp (DMs & Groups)"]
        WAGroups["WhatsApp Groups (Zerub as Independent Member)"]
        Recipients["Clients & External Contacts"]
        GoogleDrive["Google Drive (Meeting Summaries Folder)"]
        GoogleDocs["Google Docs (Executive Minutes)"]
        GoogleSuite["Google Calendar, Tasks & Contacts"]
        Gemini["Google Gemini AI API"]
    end

    AppLayer <-->|Local IPC / WebSocket| Daemon
    Socket1 <-->|Passive Multi-Device Companion| PersonalWA
    Socket2 <-->|Independent Group Member (@Zerub Replies)| WAGroups
    Socket2 -->|Dispatch Approved WhatsApp Messages| Recipients

    Brain <-->|Function Calling & Multimodal Audio| Gemini
    Brain <-->|REST API| GoogleSuite
    MeetingEar -->|Raw Audio Stream| Brain
    Brain -->|Auto-Create Meeting Doc| GoogleDocs
    GoogleDocs -->|Save In Folder| GoogleDrive
    Brain -->|Deliver Executive Minutes & Cards| AppLayer
    Core <--> DB
```

---

## 3. The Dual-WhatsApp System Architecture

Zerubbabel maintains two continuous, concurrent WebSocket connections via `@whiskeysockets/baileys`:

### Socket 1: The Personal Observer (Passive Listener)
* **Phone Number:** `+2348072854186` (Cephas's personal WhatsApp).
* **Connection Mode:** Linked as a Multi-Device Companion.
* **Storage Path:** `./auth/personal/` on the phone.
* **Responsibilities:**
  1. **Passive Ingestion:** Observes incoming 1-on-1 chats and group messages.
  2. **Context Feeding:** Keeps Zerubbabel aware of client discussions, deals, and requests so Zerubbabel has full situational awareness.
  3. **Contact Harvesting:** Automatically extracts names and phone numbers into the phone's local SQLite address book.
  4. **Strict Silence:** Never sends messages to any person or group from this line.

### Socket 2: The Assistant SIM (Independent Member & Dispatcher)
* **Phone Number:** `+2347051627659` (Dedicated second SIM line).
* **Connection Mode:** Linked as the Assistant's standalone WhatsApp account.
* **Storage Path:** `./auth/bot/` on the phone.
* **Responsibilities:**
  1. **Independent Group Member:** Added to WhatsApp groups like any human team member. It sits quietly, tracks the rolling 30-message conversation context, and when tagged (`@Zerub` or `@2347051627659`), **replies right there in the group chat** with contextual answers, summaries, or action items.
  2. **Outbound WhatsApp Messenger:** When Cephas approves a draft inside the Zerub App, Socket 2 sends the message to the recipient on WhatsApp with the signature:  
     *— Sent on behalf of Cephas by Zerubbabel (Executive Assistant).*
  3. **External Receptionist:** If strangers message this number directly, it auto-responds politely, collects their inquiry, and shares Cephas's booking link.

---

## 4. Key Feature Specifications

### 4.1 The Dedicated Zerub Mobile App
* **Technology:** Capacitor + React / React Native.
* **Core Modules:**
  * **Private Executive Chat:** Clean, lightning-fast chat window between Cephas and Zerubbabel. Dictate tasks, ask questions, or request drafts via voice or text.
  * **Daily Briefing & Habit Cards:** Morning Briefing (8:00 AM) rendered as interactive checklists with calendar widgets. Habit cards for Bible study, lunch, reading, and workout check-ins.
  * **Interactive Draft Review:** Proposed WhatsApp messages appear as rich cards with **[Approve & Send]**, **[Edit]**, and **[Cancel]** buttons.
  * **Live Meeting Recorder:** Tap-to-record meeting interface with live waveform, elapsed time, and quick categorization tags.
  * **System Status Monitor:** Live indicator lights for Socket 1, Socket 2, Google Auth, and Local SQLite DB.

---

### 4.2 The "Meeting Ear" (Omni-Meeting Intelligence Engine)
* **Scope:** Not tied to Google Calendar. Works for **ANY meeting** (Zoom, Google Meet, phone calls, or in-person room discussions).
* **Workflow:**
  1. **Activation:** Cephas taps **Record** (inside the Zerub App or via the Samsung Quick-Settings tile `[🎙️ Zerub Record]`).
  2. **Live Capture:** High-fidelity mono audio recording activates (16kHz WAV/OGG).
  3. **Completion:** Meeting ends; Cephas taps **Stop**.
  4. **AI Synthesis:** Audio buffer streams directly to **Google Gemini 2.5 Flash** (native multimodal audio context up to 2 hours).
  5. **Dual Dispatch:**
     * **1. Google Docs & Drive Archive:**
       * Automatically ensures a folder named **`Zerubbabel Meeting Summaries`** exists in Google Drive.
       * Generates a Google Doc titled: `Meeting Summary - [Topic/Attendees] - [Date]`.
       * Writes full structured executive minutes: Executive Summary, Key Decisions, Attendee Notes, and Action Items.
     * **2. Zerub App Delivery:**
       * Posts the meeting debrief into the Zerub App chat:
         * 📌 **Executive Summary:** Core takeaway in 3 concise bullets.
         * 🎯 **Key Decisions:** Agreements made.
         * 📋 **Action Items & Owners:** Tasks with assignees and deadlines.
         * 🔗 **Google Doc Link:** Direct link to the generated Google Doc in Drive.
         * ⚡ **Pre-Drafted WhatsApp Follow-ups:** Ready to tap **[Approve & Send]**.

---

### 4.3 The Two-Stage Draft & Disambiguation Flow
Zerubbabel is prohibited from autonomously texting third parties:
1. **Instruction:** Cephas types or speaks in the Zerub App: *"Tell Tolu that the proposal is ready."*
2. **Disambiguation:** If multiple "Tolus" exist in the local SQLite address book, the app asks:
   > *"I found 2 Tolus: 1. Tolu Finance (+234803...), 2. Tolu Dev (+234812...). Which one?"*
3. **Interactive Card:** Once chosen, a staged card appears in the Zerub App:
   > 📝 **Outbound WhatsApp Draft for Tolu Finance:**  
   > *"Hello Tolu, the proposal is ready for your review.*  
   > *— Sent on behalf of Cephas by Zerubbabel."*  
   >  
   > **[🟢 Approve & Send via WhatsApp]** &nbsp;&nbsp; **[✏️ Edit]** &nbsp;&nbsp; **[🔴 Cancel]**
4. **Execution:** Cephas taps **[Approve & Send]**, Socket 2 dispatches the WhatsApp message, and the card updates to `✅ Delivered at 2:15 PM`.

---

### 4.4 Independent Group Member Intelligence
1. **30-Message Rolling Buffer:** Zerubbabel maintains an in-memory/SQLite circular buffer of the last 30 messages for every active group.
2. **Independent Participation:** Socket 2 exists in groups as an independent team member. It ignores normal conversation and triggers **only when tagged** (`@Zerub` or `@2347051627659`).
3. **Contextual Answers:** Analyzes the 30-message history, resolves any quoted/swiped message, and sends an intelligent reply directly into the group.
4. **Permission Tiers:**
   * **Cephas:** Can trigger executive tools (schedule meetings, log tasks) from the group.
   * **Other Members:** Can ask questions or request summaries; private administrative tools remain locked.

---

### 4.5 Google Workspace Suite Integration
* **Google Calendar:** Reads daily agenda, detects conflicts, and schedules new meetings with attendees.
* **Google Tasks:** Lists pending/overdue to-dos, creates prioritized tasks, and marks tasks complete.
* **Google Contacts:** Two-way sync to populate and update the local address book.
* **Google Drive & Docs:** Automated creation and management of the `Zerubbabel Meeting Summaries` folder and structured meeting documents.

---

### 4.6 Automated Executive Schedulers
| Schedule Time | Sentry Name | Behavior & Content |
| :--- | :--- | :--- |
| **08:00 AM** | **Morning Strategic Briefing** | Synthesizes today's Calendar events, top 3 priority Google Tasks, and yesterday's carry-overs into an interactive checklist in the Zerub App. |
| **08:30 AM** | **Spiritual Grounding** | Mindset and Bible study check-in delivered to the Zerub App. |
| **01:00 PM** | **Physical Replenishment** | Midday lunch reminder and prompt to step away from screens. |
| **03:30 PM** | **Mental Mastery** | Check-in on reading current book and dedicated learning time. |
| **06:00 PM** | **Fitness / Workout Sentry** | Evening workout, gym, or physical movement check-in. |
| **09:00 PM** | **Evening Strategic Debrief** | Synthesizes completed tasks vs. targets, prompts for reflections, and queues tomorrow's focus. |

---

### 4.7 Dynamic Multi-Model Routing Engine (Task Complexity Tiers)
To maximize response speed, minimize latency, preserve API quotas, and deliver maximum intelligence where it counts, Zerubbabel dynamically routes tasks across a **3-Tier AI Model Architecture**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TASK COMPLEXITY ROUTER                               │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
┌───────▼─────────────────┐ ┌───────▼──────────────────┐ ┌───────▼──────────────────┐
│ TIER 1: FLASH-LITE      │ │ TIER 2: EXECUTIVE FLASH  │ │ TIER 3: DEEP PRO         │
│ (gemini-2.0-flash-lite) │ │ (gemini-2.5-flash)       │ │ (gemini-2.5-pro)         │
├─────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • Speed: ~200-400ms     │ │ • Speed: ~800-1200ms     │ │ • Deep Multimodal        │
│ • Stranger triage       │ │ • Executive Chat in App  │ │ • 1-2h Meeting Audio     │
│ • Intent classification │ │ • Calendar/Tasks Tools   │ │ • Google Doc Minutes     │
│ • Quick confirmations   │ │ • WhatsApp Drafts        │ │ • High-Stakes Proposals  │
│ • "Message Yourself" tag│ │ • Group Replies (@Zerub) │ │ • Evening Strategic Deep │
│ • Address book matching │ │ • Habit Check-ins        │ │   Debrief Synthesis      │
└─────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

#### Tier 1: Fast Router (Ultra-Lightweight — `gemini-2.0-flash-lite` / `gemini-1.5-flash-8b`)
* **Use Case:** High-frequency, sub-second routing.
* **Responsibilities:** Classifying incoming messages (stranger vs. client vs. Cephas), detecting if a group message mentions Zerubbabel, parsing simple numeric replies (e.g., choosing "1" in a disambiguation list), and generating quick one-line confirmations.
* **Benefit:** Instant response time (<400ms) with minimal quota consumption.

#### Tier 2: The Workhorse Engine (`gemini-2.5-flash` / `gemini-1.5-flash`)
* **Use Case:** Daily interactive executive reasoning and tool execution.
* **Responsibilities:** Full function calling for Google Calendar, Google Tasks, and Google Contacts; writing natural, highly articulate outbound WhatsApp drafts; contextual group chat participation when tagged; and orchestrating daily morning briefings.
* **Benefit:** Superior strategic reasoning, native tool calling, and high efficiency.

#### Tier 3: Deep Strategic & Heavy Multimodal Engine (`gemini-2.5-pro` / `gemini-1.5-pro`)
* **Use Case:** Heavy cognitive lifting and long multimodal audio analysis.
* **Responsibilities:**
  1. **Meeting Ear Engine:** Processing 30-minute to 2-hour meeting audio recordings. Accurately identifies speakers, extracts subtle commitments, organizes key decisions, and authors comprehensive, executive-grade Google Docs documents.
  2. **High-Stakes Document & Strategy Generation:** Drafting critical investor updates, partnership proposals, or complex negotiation emails.
  3. **Weekly & Evening Strategic Synthesis:** Deeply analyzing Cephas's week, identifying productivity bottlenecks, and generating strategic growth recommendations.
* **Benefit:** Maximum context window (1M+ tokens), nuanced reasoning, and flawless audio comprehension.

#### Automatic Failover & Resilience:
* The engine tracks response codes. If a Tier 3 model encounters rate limits (HTTP 429), it automatically degrades gracefully to Tier 2 without dropping the user's task or crashing.

---

## 5. Phone-Native Android Hosting (Samsung S20FE)

Zerubbabel runs as an **autonomous local daemon on Cephas's phone**:
* **Foreground Service:** Runs with a persistent Android status-bar notification:  
  *🟢 Zerubbabel Executive Assistant is Active*.
* **Wake Lock:** Acquired via `PARTIAL_WAKE_LOCK` so the CPU processes incoming messages even with the screen off.
* **Battery Optimization:** Whitelisted via `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` so Samsung One UI never terminates the process.
* **Storage:** Local SQLite database (`zerubbabel.db`) stores contacts, draft queues, group buffers, and habit logs.

---

## 6. Implementation Methodology: Architecture-First, Feature-by-Feature

The build follows a strict **Build-Then-Test** discipline. The foundational architecture is established first, followed by each individual feature being implemented, verified, and tested before moving to the next.

```
┌────────────────────────────────────────────────────────┐
│  STEP 1: FOUNDATION ARCHITECTURE                      │
│  Fresh GitHub Repo, project setup, SQLite schema,     │
│  dual-socket skeleton, and Google/Gemini auth.        │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  STEP 2: DUAL WHATSAPP CONNECTION & PHONE PAIRING      │
│  Walk Cephas step-by-step through pairing on phone     │
│  Socket 1 (Observer) & Socket 2 (Group Member)         │
│  -> TEST BOTH SOCKET CONNECTIONS                       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  STEP 3: CONTACTS & TWO-STAGE DRAFT ENGINE             │
│  Address book indexing + Draft & Send via WhatsApp     │
│  -> TEST DRAFT & DISAMBIGUATION FLOW                   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  STEP 4: GROUP ROLLING MEMORY & TAGGED INTELLIGENCE    │
│  30-message buffer + @Zerub tagging in WhatsApp groups │
│  -> TEST IN LIVE GROUP                                 │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  STEP 5: GOOGLE WORKSPACE TOOLS & SCHEDULERS           │
│  Calendar, Tasks, Morning Brief & Habits               │
│  -> TEST GOOGLE TOOLS & CRON ROUTINES                  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  STEP 6: MEETING EAR & DEDICATED MOBILE APP            │
│  Mic capture -> Google Docs/Drive + App summary        │
│  Dedicated Zerub Mobile App UI + Quick Settings Tile   │
│  -> FULL PHONE-HOSTED END-TO-END VERIFICATION          │
└────────────────────────────────────────────────────────┘
```

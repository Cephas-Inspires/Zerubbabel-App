# Zerubbabel (Cephas EA)
> **Autonomous AI Executive Assistant & Chief of Staff**  
> *100% Phone-Hosted (Samsung S20FE) • Zero Cloud Server Bills • Dual WhatsApp Engine*

---

## 🏛️ Executive Vision

**Zerubbabel** is a dedicated phone-native, autonomous AI Executive Assistant built exclusively for **Cephas** (Founder & Strategic Leader).

* **100% Phone-Hosted (NOT on Laptop):** The daemon runs 24/7 in Cephas's pocket on Android as a foreground service with persistent wake-lock and battery optimization exemption.
* **Dual WhatsApp Under the Hood:**
  * **Socket 1 (Personal Observer — `+2348072854186`):** Multi-Device companion that silently harvests contacts and ingests business context without speaking.
  * **Socket 2 (Assistant SIM — `+2347051627659`):** Independent WhatsApp group member that replies directly when tagged (`@Zerub`), and dispatches approved outbound drafts.
* **Omni-Meeting Intelligence ("Meeting Ear"):** Instant audio capture of any Zoom, Google Meet, phone call, or in-person meeting. Auto-creates structured minutes in Google Docs within the `Zerubbabel Meeting Summaries` Google Drive folder.
* **Dynamic 3-Tier Multi-Model Engine:**
  * **Tier 1 (Flash-Lite — `gemini-2.0-flash-lite`):** Sub-second routing, stranger triage, intent classification.
  * **Tier 2 (Executive Flash — `gemini-2.5-flash`):** Daily executive chat, drafts, tool calling, and group replies.
  * **Tier 3 (Deep Pro — `gemini-2.5-pro`):** Long meeting audio comprehension, Google Doc authoring, and strategic synthesis.
* **Strict Safety Protocol:** Zero autonomous texting. All outbound messages require Cephas's explicit approval in the executive cockpit app.

---

## 📐 Architecture Overview

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
            Brain["Dynamic 3-Tier Gemini AI Engine"]
            DB[(Local SQLite Database: zerubbabel.db)]
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

## 🛠️ Step 1: Foundation Architecture Status

| Component | Status | Details |
| :--- | :--- | :--- |
| **Git Repository** | ✅ Initialized | Brand new repo `Zerubbabel-App` (`main` branch) |
| **Local SQLite Engine** | ✅ Verified | WAL mode, 7 core tables, foreign keys, DAO methods |
| **3-Tier AI Router** | ✅ Verified | Automatic 429 failover, sub-second routing |
| **Dual WhatsApp Skeleton** | ✅ Verified | Baileys v7, MultiFileAuth, Socket 1 passive, Socket 2 dispatcher |
| **Local IPC & API Server** | ✅ Verified | Port `4892` with real-time WebSocket broadcasting |
| **Google Auth Scaffold** | ✅ Verified | OAuth2 & Service Account support for Docs/Drive/Calendar/Tasks |

---

## 🚀 Quick Verification Commands

```bash
# 1. Test SQLite Database Schema and DAO methods
npm run test:db

# 2. Test Multi-Model AI Routing logic
npm run test:ai

# 3. Compile TypeScript
npm run build

# 4. Launch Zerubbabel Daemon
npm run dev
```

---

## 📲 Step 2 Preview: Phone Pairing Protocol

### Pairing Socket 1 (Cephas's Personal Line: `+2348072854186`):
```bash
# Via QR Code:
npm run pair:personal

# Or via 8-digit Pairing Code:
npm run pair:personal -- --code
```
*Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan QR or enter pairing code.*

### Pairing Socket 2 (Zerubbabel Assistant SIM: `+2347051627659`):
```bash
# Via QR Code:
npm run pair:assistant

# Or via 8-digit Pairing Code:
npm run pair:assistant -- --code
```
*Open WhatsApp with the assistant SIM account → Settings → Linked Devices → Link a Device → Scan QR or enter pairing code.*

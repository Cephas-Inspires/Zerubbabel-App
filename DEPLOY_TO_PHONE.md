# 📱 Zerubbabel — 100% Phone-Native Deployment Guide (Samsung S20FE)
> **Run Zerubbabel 24/7 in your pocket with ZERO cloud server bills and your laptop turned off.**

---

## 🏛️ Executive Deployment Overview

Once deployed to your Samsung S20FE:
1. **The Daemon Runs in the Background:** Maintains both WhatsApp WebSockets (Socket 1 Observer & Socket 2 SIM), SQLite database, and Schedulers.
2. **The Executive Cockpit Lives on Your Home Screen:** Installed as a full-screen mobile app icon.
3. **The Laptop Can Be Off:** Your phone is the production server, database, and client all in one.

---

## 🚀 Step-by-Step Setup on Your Samsung Phone (Takes 5 Minutes)

### Step 1: Install Termux & Termux:API (From F-Droid)
1. Download **F-Droid** on your phone from [f-droid.org](https://f-droid.org/).
2. Open F-Droid, search for and install:
   * **Termux** (Terminal emulator and Linux environment)
   * **Termux:API** (Allows accessing phone microphone, contacts, and wake-lock)

---

### Step 2: Grant Android Permissions (Never Sleep Mode)
To ensure Samsung One UI never terminates Zerubbabel in your pocket:
1. Open phone **Settings** > **Apps** > **Termux**.
2. Tap **Battery** > Select **Unrestricted** (disables Samsung battery optimization).
3. Tap **Permissions** > Allow **Microphone**, **Contacts**, and **Storage**.

---

### Step 3: Set Up Node.js & Project in Termux
Open the **Termux** app on your phone and run these commands:

```bash
# 1. Update packages and install Node.js & Git
pkg update -y
pkg install -y nodejs git termux-api

# 2. Clone your repository (or copy from PC)
git clone <YOUR_GITHUB_REPO_URL> Zerubbabel-App
cd Zerubbabel-App

# 3. Install dependencies and build
npm install
npm run build

# 4. Copy your .env and auth credentials
# (Copy .env from laptop, or paste your GEMINI_API_KEY into .env)
```

---

### Step 4: Run Zerubbabel 24/7 in Background
Run this in Termux:

```bash
# Acquire Android Wake-Lock so the CPU processes messages with screen off:
termux-wake-lock

# Start the Zerubbabel daemon:
npm start
```
*Tip: You can use `pm2` (`npm install -g pm2 && pm2 start dist/index.js --name zerubbabel`) so it automatically restarts if Android ever restarts.*

---

### Step 5: Install Executive Cockpit onto Your Samsung Home Screen
1. On your Samsung phone, open **Google Chrome** (or Samsung Internet).
2. Go to: **`http://localhost:4892`**
3. Tap the browser menu (**⋮** in top right).
4. Tap **"Add to Home screen"** or **"Install App"**.
5. An icon named **Zerubbabel** will appear on your Samsung phone's Home Screen!

---

## 🎯 How to Use Your Pocket Chief of Staff

* **Executive Chat:** Open the Zerub app from your home screen. Dictate instructions:  
  * *"Tell Tolu that the proposal is ready."*  
  * *"Spent 15k on fuel at Total and 4500 on lunch."*
* **The Meeting Ear:** Tap **Meeting Ear** tab > Tap **[🎙️ Record]** during any Zoom, Google Meet, or in-person discussion. Tap **[⏹️ Stop]** when done; Zerubbabel delivers the minutes, action items, and stages follow-up messages!
* **WhatsApp Draft Approvals:** Switch to the **Drafts** tab and tap **[🟢 Approve & Send]** to dispatch via Socket 2.
* **Daily Routines:** 8:00 AM Morning Briefing, 8:00 PM Daily Expense check-in, and Saturday 10:00 PM Financial Breakdown arrive automatically!

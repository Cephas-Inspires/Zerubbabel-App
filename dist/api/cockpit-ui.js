export const renderCockpitHtml = (apiPort) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Zerubbabel — Executive Cockpit</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0b0f19">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Zerubbabel">
  <link rel="apple-touch-icon" href="/icon-192.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151d2f;
      --card-border: #232e47;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    /* Header */
    header {
      background: var(--card);
      border-bottom: 1px solid var(--card-border);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .header-title { font-size: 17px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .status-badges { display: flex; gap: 6px; }
    .status-dot {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: #1e293b;
      color: var(--text-muted);
    }
    .dot-green { width: 7px; height: 7px; border-radius: 50%; background: var(--success); }
    .dot-yellow { width: 7px; height: 7px; border-radius: 50%; background: var(--warning); }

    /* Main Container */
    main {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    /* Tabs Bar at Bottom */
    nav.bottom-nav {
      background: var(--card);
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: space-around;
      padding: 8px 4px calc(8px + env(safe-area-inset-bottom, 0px));
      flex-shrink: 0;
    }
    .nav-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 8px;
    }
    .nav-btn.active { color: var(--primary); }
    .nav-btn .icon { font-size: 18px; }

    /* Views */
    .view-tab { display: none; flex: 1; flex-direction: column; }
    .view-tab.active { display: flex; }

    /* Chat View */
    .chat-container { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 12px; }
    .msg { max-width: 85%; padding: 12px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
    .msg-user { align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 2px; }
    .msg-assistant { align-self: flex-start; background: var(--card); border: 1px solid var(--card-border); border-bottom-left-radius: 2px; }
    .chat-input-bar { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid var(--card-border); }
    .chat-input { flex: 1; background: var(--card); border: 1px solid var(--card-border); border-radius: 20px; padding: 10px 16px; color: white; font-size: 14px; outline: none; }
    .chat-btn { background: var(--primary); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; }

    /* Draft Cards */
    .card { background: var(--card); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; font-weight: 600; }
    .draft-quote { background: #0f172a; border-left: 3px solid var(--primary); padding: 10px 12px; font-size: 13px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn-approve { background: var(--success); color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; flex: 1; }
    .btn-cancel { background: transparent; border: 1px solid var(--card-border); color: var(--text-muted); padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }

    /* Meeting Ear Screen */
    .record-panel { text-align: center; padding: 24px 16px; }
    .record-btn {
      width: 80px; height: 80px; border-radius: 50%; background: #dc2626; color: white; border: 4px solid #f87171;
      font-size: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
      transition: all 0.2s; box-shadow: 0 0 20px rgba(220, 38, 38, 0.4);
    }
    .record-btn.recording { background: #991b1b; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
    .timer { font-size: 24px; font-weight: 700; margin-bottom: 8px; font-variant-numeric: tabular-nums; }

    /* Habit Checklist */
    .habit-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--card); border: 1px solid var(--card-border); border-radius: 10px; margin-bottom: 8px; }
    .habit-title { font-size: 14px; font-weight: 600; }
    .habit-time { font-size: 12px; color: var(--text-muted); }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="header-title">
      <span>🏛️</span> Zerubbabel
      <button id="installAppBtn" onclick="installPwa()" style="display:none; margin-left:8px; padding:3px 10px; background:#2563eb; color:#fff; border:none; border-radius:12px; font-size:11px; font-weight:600; cursor:pointer;">📲 Install App</button>
    </div>
    <div class="status-badges">
      <div class="status-dot" id="socket1Badge"><span class="dot-green"></span> Observer</div>
      <div class="status-dot" id="socket2Badge"><span class="dot-green"></span> SIM</div>
      <button onclick="handleGoogleConnect()" class="status-dot" style="background:#1e293b; border:none; cursor:pointer; color:#60a5fa;" id="googleBadge">
        Google Connect
      </button>
    </div>
  </header>

  <!-- Content Views -->
  <main>
    <!-- VIEW 1: Executive Chat -->
    <div class="view-tab active" id="viewChat">
      <div class="chat-container" id="chatList">
        <div class="msg msg-assistant">Good day Cephas. Zerubbabel Chief of Staff is online and running locally on your phone. How can I assist with strategy, communications, or finance today?</div>
      </div>
      <div class="chat-input-bar">
        <input type="text" class="chat-input" id="chatInput" placeholder="Message Zerubbabel or dictate..." />
        <button class="chat-btn" id="sendBtn">➤</button>
      </div>
    </div>

    <!-- VIEW 2: Meeting Ear -->
    <div class="view-tab" id="viewMeeting">
      <div class="card record-panel">
        <h3>🎙️ The Meeting Ear</h3>
        <p style="color:var(--text-muted); font-size:13px;">Tap to record any Zoom, Meet, phone call, or in-person discussion. Transcribes and generates Google Docs minutes automatically.</p>
        <button class="record-btn" id="recordBtn">🎙️</button>
        <div class="timer" id="recordTimer">00:00</div>
        <p id="recordStatus" style="font-size:13px; color:#10b981;">Ready to Record</p>
      </div>
      <div id="meetingList">
        <h4 style="margin: 16px 0 8px;">Recent Meeting Sessions</h4>
      </div>
    </div>

    <!-- VIEW 3: WhatsApp Drafts -->
    <div class="view-tab" id="viewDrafts">
      <h3 style="margin-top:0;">📝 Outbound WhatsApp Drafts</h3>
      <p style="color:var(--text-muted); font-size:13px;">Zero autonomous texting. Review and approve each outbound message below:</p>
      <div id="draftsList">
        <p style="color:#6b7280; font-size:13px;">No pending drafts right now.</p>
      </div>
    </div>

    <!-- VIEW 4: Habits & Briefings -->
    <div class="view-tab" id="viewHabits">
      <h3 style="margin-top:0;">📋 Executive Sentry & Habits</h3>
      <div id="habitsList">
        <!-- populated via js -->
      </div>
    </div>

    <!-- VIEW 5: Finance Tracker -->
    <div class="view-tab" id="viewFinance">
      <h3 style="margin-top:0;">💰 Cephas Finance Tracker</h3>
      <div class="card">
        <div class="card-header">
          <span>Quick Expense Logger</span>
          <span style="color:#10b981; font-size:12px;">Active</span>
        </div>
        <input type="text" class="chat-input" id="expenseInput" placeholder="e.g. 15k fuel, 4500 lunch, $20 tool" style="width:100%; margin-bottom:8px;" />
        <button class="btn-approve" id="logExpenseBtn">Log to Google Sheets</button>
      </div>
      <div id="financeList">
        <!-- populated via js -->
      </div>
    </div>
  </main>
 
  <!-- Google Setup Modal -->
  <div id="googleModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; align-items:center; justify-content:center; padding:20px;">
    <div style="background:#151d2f; border:1px solid #232e47; border-radius:14px; max-width:440px; width:100%; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.6);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px; color:#fff;">🔗 Connect Google Account</h3>
        <button onclick="closeGoogleModal()" style="background:none; border:none; color:#9ca3af; font-size:20px; cursor:pointer;">✕</button>
      </div>
      <p style="font-size:12px; color:#9ca3af; margin-top:0; line-height:1.4;">
        Sign in with Google to grant Zerubbabel permission to manage your Google Calendar, Google Docs, Google Sheets, Google Tasks, and Drive.
      </p>
      
      <div id="googleConnectedView" style="display:none;">
        <div style="background:#064e3b; border:1px solid #059669; padding:12px; border-radius:8px; margin-bottom:14px;">
          <p style="margin:0; font-size:13px; color:#a7f3d0; font-weight:600;">✅ Google Workspace Connected!</p>
          <p style="margin:4px 0 0; font-size:11px; color:#6ee7b7;">Your account is fully authenticated and synchronized.</p>
        </div>
        <button onclick="window.location.href='/auth/google'" style="width:100%; padding:10px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">
          🔄 Re-Authenticate Google Account
        </button>
      </div>

      <div id="googleSetupView" style="display:none;">
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:#d1d5db; display:block; margin-bottom:4px;">Google OAuth Client ID</label>
          <input type="text" id="gClientId" placeholder="e.g. 12345678-xxx.apps.googleusercontent.com" style="width:100%; background:#0b0f19; border:1px solid #374151; color:#fff; padding:8px 10px; border-radius:6px; font-size:12px; box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px; font-weight:600; color:#d1d5db; display:block; margin-bottom:4px;">Google OAuth Client Secret</label>
          <input type="password" id="gClientSecret" placeholder="e.g. GOCSPX-xxxxxx" style="width:100%; background:#0b0f19; border:1px solid #374151; color:#fff; padding:8px 10px; border-radius:6px; font-size:12px; box-sizing:border-box;" />
        </div>
        <button onclick="saveGoogleCreds()" style="width:100%; padding:11px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; margin-bottom:10px;">
          💾 Save &amp; Log In With Google
        </button>
        <p style="font-size:11px; color:#6b7280; text-align:center; margin:0; line-height:1.4;">
          Redirect URI registered on Google Console must be: <br><code style="color:#60a5fa;">http://localhost:4892/auth/google/callback</code>
        </p>
      </div>
    </div>
  </div>

  <!-- Bottom Navigation -->
  <nav class="bottom-nav">
    <button class="nav-btn active" onclick="switchTab('viewChat', this)">
      <span class="icon">💬</span>
      <span>Chat</span>
    </button>
    <button class="nav-btn" onclick="switchTab('viewMeeting', this)">
      <span class="icon">🎙️</span>
      <span>Meeting Ear</span>
    </button>
    <button class="nav-btn" onclick="switchTab('viewDrafts', this)">
      <span class="icon">📝</span>
      <span>Drafts</span>
    </button>
    <button class="nav-btn" onclick="switchTab('viewHabits', this)">
      <span class="icon">📋</span>
      <span>Habits</span>
    </button>
    <button class="nav-btn" onclick="switchTab('viewFinance', this)">
      <span class="icon">💰</span>
      <span>Finance</span>
    </button>
  </nav>

  <script>
    // Tab switching
    function switchTab(viewId, btn) {
      document.querySelectorAll('.view-tab').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(viewId).classList.add('active');
      btn.classList.add('active');
      if (viewId === 'viewDrafts') loadDrafts();
      if (viewId === 'viewHabits') loadHabits();
      if (viewId === 'viewFinance') loadFinances();
      if (viewId === 'viewMeeting') loadMeetings();
    }

    // Chat
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatList = document.getElementById('chatList');

    // Chat History & Persistence
    async function loadChat() {
      try {
        const res = await fetch('/api/chat');
        const data = await res.json();
        if (!data.messages || data.messages.length === 0) return;
        chatList.innerHTML = '';
        for (const msg of data.messages) {
          const div = document.createElement('div');
          div.className = msg.role === 'user' ? 'msg msg-user' : 'msg msg-assistant';
          div.innerText = msg.content;
          chatList.appendChild(div);
        }
        chatList.scrollTop = chatList.scrollHeight;
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    }

    async function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';

      // Append user msg
      const userDiv = document.createElement('div');
      userDiv.className = 'msg msg-user';
      userDiv.innerText = text;
      chatList.appendChild(userDiv);
      chatList.scrollTop = chatList.scrollHeight;

      // Show temporary thinking state
      const typingDiv = document.createElement('div');
      typingDiv.className = 'msg msg-assistant';
      typingDiv.id = 'tempTyping';
      typingDiv.innerText = 'Thinking...';
      typingDiv.style.opacity = '0.6';
      chatList.appendChild(typingDiv);
      chatList.scrollTop = chatList.scrollHeight;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        const typingEl = document.getElementById('tempTyping');
        if (typingEl) typingEl.remove();

        const botDiv = document.createElement('div');
        botDiv.className = 'msg msg-assistant';

        if (data.reply) {
          botDiv.innerText = data.reply;
        } else if (data.error) {
          botDiv.innerText = '⚠️ Error: ' + data.error;
          botDiv.style.borderColor = '#ef4444';
          botDiv.style.color = '#fca5a5';
        } else {
          botDiv.innerText = 'Instruction received.';
        }

        chatList.appendChild(botDiv);
        chatList.scrollTop = chatList.scrollHeight;
        if (data.type === 'draft_staged') loadDrafts();
      } catch (err) {
        const typingEl = document.getElementById('tempTyping');
        if (typingEl) typingEl.remove();
        alert('Network error: ' + err.message);
      }
    }

    sendBtn.onclick = sendChat;
    chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };

    // Google Setup Handlers
    async function handleGoogleConnect() {
      try {
        const res = await fetch('/api/google/status');
        const data = await res.json();
        const modal = document.getElementById('googleModal');
        const setupView = document.getElementById('googleSetupView');
        const connectedView = document.getElementById('googleConnectedView');

        if (data.authenticated) {
          setupView.style.display = 'none';
          connectedView.style.display = 'block';
        } else if (data.configured) {
          // Credentials already configured -> go straight to Google Consent
          window.location.href = '/auth/google';
          return;
        } else {
          setupView.style.display = 'block';
          connectedView.style.display = 'none';
        }
        modal.style.display = 'flex';
      } catch (err) {
        alert('Could not check Google status: ' + err.message);
      }
    }

    function closeGoogleModal() {
      document.getElementById('googleModal').style.display = 'none';
    }

    async function saveGoogleCreds() {
      const clientId = document.getElementById('gClientId').value.trim();
      const clientSecret = document.getElementById('gClientSecret').value.trim();

      if (!clientId || !clientSecret) {
        alert('Please fill in both Client ID and Client Secret.');
        return;
      }

      try {
        const res = await fetch('/api/google/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret })
        });
        const data = await res.json();
        if (data.success) {
          alert('Credentials saved! Redirecting to Google Login...');
          window.location.href = '/auth/google';
        } else {
          alert(data.error || 'Failed to save credentials');
        }
      } catch (err) {
        alert('Error saving credentials: ' + err.message);
      }
    }

    // Load Drafts
    async function loadDrafts() {
      const res = await fetch('/api/drafts');
      const data = await res.json();
      const list = document.getElementById('draftsList');
      if (!data.drafts || data.drafts.length === 0) {
        list.innerHTML = '<p style="color:#6b7280; font-size:13px;">No pending drafts right now.</p>';
        return;
      }
      list.innerHTML = data.drafts.map(d => \`
        <div class="card" id="draft-\${d.id}">
          <div class="card-header">
            <span>To: \${d.recipient_name || '+' + d.recipient_phone}</span>
            <span style="color:#f59e0b; font-size:12px;">Pending Review</span>
          </div>
          <div class="draft-quote">"\${d.draft_text}"</div>
          <div style="font-size:11px; color:#6b7280;">— Sent on behalf of Cephas by Zerubbabel</div>
          <div class="card-actions">
            <button class="btn-approve" onclick="approveDraft(\${d.id})">🟢 Approve &amp; Send</button>
            <button class="btn-cancel" onclick="cancelDraft(\${d.id})">Cancel</button>
          </div>
        </div>
      \`).join('');
    }

    async function approveDraft(id) {
      const res = await fetch('/api/drafts/' + id + '/approve', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Draft Approved!');
      loadDrafts();
    }

    async function cancelDraft(id) {
      await fetch('/api/drafts/' + id + '/cancel', { method: 'POST' });
      loadDrafts();
    }

    // Load Habits
    async function loadHabits() {
      const res = await fetch('/api/habits');
      const data = await res.json();
      const list = document.getElementById('habitsList');
      const sentries = [
        { key: 'morning_briefing', title: '08:00 AM Morning Strategic Briefing' },
        { key: 'spiritual_grounding', title: '08:30 AM Spiritual Grounding' },
        { key: 'physical_replenishment', title: '01:00 PM Physical Replenishment (Lunch)' },
        { key: 'mental_mastery', title: '03:30 PM Mental Mastery (Reading)' },
        { key: 'fitness_workout', title: '06:00 PM Fitness & Movement' },
        { key: 'daily_expense_checkin', title: '08:00 PM Daily Expense Check-in' },
        { key: 'evening_debrief', title: '09:00 PM Evening Strategic Debrief' }
      ];
      list.innerHTML = sentries.map(s => {
        const found = data.habits?.find(h => h.habit_key === s.key);
        const done = found?.status === 'completed';
        return \`
          <div class="habit-item">
            <div>
              <div class="habit-title">\${s.title}</div>
              <div class="habit-time">\${done ? '✅ Completed' : '⏳ Pending'}</div>
            </div>
            <button class="\${done ? 'btn-cancel' : 'btn-approve'}" style="flex:none;" onclick="toggleHabit('\${s.key}', '\${s.title}', '\${done ? 'pending' : 'completed'}')">
              \${done ? 'Undo' : 'Complete'}
            </button>
          </div>
        \`;
      }).join('');
    }

    async function toggleHabit(key, title, status) {
      await fetch('/api/habits/' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status })
      });
      loadHabits();
    }

    // Load Finances
    async function loadFinances() {
      const res = await fetch('/api/finances');
      const data = await res.json();
      const list = document.getElementById('financeList');
      if (!data.expenses || data.expenses.length === 0) {
        list.innerHTML = '<p style="color:#6b7280; font-size:13px;">No expenses recorded this month yet.</p>';
        return;
      }
      list.innerHTML = '<h4 style="margin:12px 0 8px;">Logged in ' + data.monthYear + '</h4>' + data.expenses.map(e => \`
        <div class="habit-item">
          <div>
            <div class="habit-title">\${e.item}</div>
            <div class="habit-time">\${e.category} • \${e.date}</div>
          </div>
          <div style="font-weight:700; color:#10b981;">
            \${e.currency === 'USD' ? '$' : '₦'}\${Number(e.amount).toLocaleString()}
          </div>
        </div>
      \`).join('');
    }

    document.getElementById('logExpenseBtn').onclick = async () => {
      const text = document.getElementById('expenseInput').value.trim();
      if (!text) return;
      document.getElementById('expenseInput').value = '';
      const res = await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      alert(data.summaryText || 'Logged successfully!');
      loadFinances();
    };

    // Meeting Ear Web Recording
    let mediaRecorder = null;
    let audioChunks = [];
    let recordInterval = null;
    let seconds = 0;
    const recordBtn = document.getElementById('recordBtn');
    const recordTimer = document.getElementById('recordTimer');
    const recordStatus = document.getElementById('recordStatus');

    recordBtn.onclick = async () => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];
          mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
          mediaRecorder.onstop = uploadRecording;
          mediaRecorder.start();
          recordBtn.classList.add('recording');
          recordBtn.innerText = '⏹️';
          recordStatus.innerText = 'Recording in progress...';
          recordStatus.style.color = '#ef4444';
          seconds = 0;
          recordInterval = setInterval(() => {
            seconds++;
            const m = String(Math.floor(seconds / 60)).padStart(2, '0');
            const s = String(seconds % 60).padStart(2, '0');
            recordTimer.innerText = m + ':' + s;
          }, 1000);
        } catch (err) {
          alert('Microphone access required: ' + err.message);
        }
      } else {
        // Stop recording
        mediaRecorder.stop();
        clearInterval(recordInterval);
        recordBtn.classList.remove('recording');
        recordBtn.innerText = '🎙️';
        recordStatus.innerText = 'Processing with Gemini Multimodal AI...';
        recordStatus.style.color = '#3b82f6';
      }
    };

    async function uploadRecording() {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('title', 'Executive Meeting ' + new Date().toLocaleTimeString());

      try {
        const res = await fetch('/api/meetings/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        recordStatus.innerText = '✅ Meeting minutes generated & saved!';
        recordStatus.style.color = '#10b981';
        alert('🎉 Meeting Debrief Ready! Title: ' + data.meeting.title);
        loadMeetings();
      } catch (err) {
        recordStatus.innerText = '❌ Failed to process recording';
        recordStatus.style.color = '#ef4444';
      }
    }

    async function loadMeetings() {
      const res = await fetch('/api/meetings');
      const data = await res.json();
      const list = document.getElementById('meetingList');
      if (!data.meetings || data.meetings.length === 0) return;
      list.innerHTML = '<h4 style="margin: 16px 0 8px;">Recent Meeting Sessions</h4>' + data.meetings.map(m => \`
        <div class="card">
          <div class="card-header">
            <span>\${m.title}</span>
            <span style="font-size:12px; color:#60a5fa;">\${m.google_doc_url ? '<a href="' + m.google_doc_url + '" target="_blank" style="color:#60a5fa;">View Doc</a>' : 'Local Archive'}</span>
          </div>
          <p style="font-size:13px; line-height:1.4; color:#d1d5db; white-space:pre-wrap;">\${m.executive_summary || 'Minutes recorded.'}</p>
        </div>
      \`).join('');
    }

    // Status sync
    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const s1 = data.whatsapp?.socket1_personal?.status === 'connected';
        const s2 = data.whatsapp?.socket2_assistant?.status === 'connected';
        document.getElementById('socket1Badge').innerHTML = '<span class="' + (s1 ? 'dot-green' : 'dot-yellow') + '"></span> Observer';
        document.getElementById('socket2Badge').innerHTML = '<span class="' + (s2 ? 'dot-green' : 'dot-yellow') + '"></span> SIM';
        if (data.google?.configured) {
          document.getElementById('googleBadge').innerHTML = '<span class="dot-green"></span> Google Synced';
        }
      } catch (err) {}
    }

    setInterval(updateStatus, 5000);
    updateStatus();
    loadDrafts();
    loadChat();

    // Service Worker Registration for Standalone PWA Mode
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = document.getElementById('installAppBtn');
      if (btn) btn.style.display = 'inline-flex';
    });

    window.installPwa = async function() {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        const btn = document.getElementById('installAppBtn');
        if (btn) btn.style.display = 'none';
      }
      deferredInstallPrompt = null;
    };
  </script>
</body>
</html>
`;

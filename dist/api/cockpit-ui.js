export const renderCockpitHtml = (apiPort) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Zerubbabel — Meeting Ear</title>
  <meta name="theme-color" content="#0b0f19">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
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
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 480px;
      width: 100%;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 32px 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: #fff;
    }
    p.subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.5;
    }
    .timer {
      font-size: 44px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      color: #fff;
      margin: 10px 0;
    }
    .record-btn-wrapper {
      position: relative;
      margin: 10px 0;
    }
    .record-btn {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      border: none;
      outline: none;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
      color: #fff;
    }
    .record-btn:active {
      transform: scale(0.95);
    }
    .record-btn.recording {
      background: linear-gradient(135deg, #475569, #334155);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      animation: pulse-ring 2s infinite;
    }
    @keyframes pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .record-btn svg {
      width: 42px;
      height: 42px;
      fill: currentColor;
    }
    .status-text {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-muted);
      min-height: 20px;
    }
    .status-text.recording {
      color: #ef4444;
      font-weight: 600;
    }
    .status-text.success {
      color: var(--success);
      font-weight: 600;
    }
    .input-title {
      width: 100%;
      background: rgba(11, 15, 25, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
      text-align: center;
      outline: none;
    }
    .input-title:focus {
      border-color: var(--primary);
    }
    .info-footer {
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--card-border);
      padding-top: 16px;
      margin-top: 10px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">🎙️ MEETING EAR</div>
    <h1>Zerubbabel Audio Ear</h1>
    <p class="subtitle">Record your client meetings or strategy sessions. Zerubbabel will automatically transcribe, extract action items, and deliver the executive summary to your WhatsApp DM.</p>

    <input type="text" id="meetingTitle" class="input-title" placeholder="Meeting Title (optional, e.g. Client Pitch)" />

    <div class="timer" id="timerDisplay">00:00:00</div>

    <div class="record-btn-wrapper">
      <button class="record-btn" id="recordBtn">
        <svg id="micIcon" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      </button>
    </div>

    <div class="status-text" id="statusText">Tap to start recording</div>

    <div class="info-footer">
      💡 All executive interactions, check-ins, briefings, and approvals happen directly in Zerubbabel's WhatsApp chat.
    </div>
  </div>

  <script>
    let mediaRecorder = null;
    let audioChunks = [];
    let startTime = null;
    let timerInterval = null;
    let isRecording = false;

    const recordBtn = document.getElementById('recordBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    const statusText = document.getElementById('statusText');
    const titleInput = document.getElementById('meetingTitle');
    const micIcon = document.getElementById('micIcon');

    function formatTime(ms) {
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      return \`\${h}:\${m}:\${s}\`;
    }

    recordBtn.addEventListener('click', async () => {
      if (!isRecording) {
        // Start Recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunks = [];
          mediaRecorder = new MediaRecorder(stream);

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(t => t.stop());
            await uploadMeetingAudio(audioBlob);
          };

          mediaRecorder.start(1000);
          isRecording = true;
          startTime = Date.now();
          recordBtn.classList.add('recording');
          statusText.className = 'status-text recording';
          statusText.textContent = '🔴 Recording live meeting... Tap to finish';

          timerInterval = setInterval(() => {
            timerDisplay.textContent = formatTime(Date.now() - startTime);
          }, 500);

        } catch (err) {
          alert('Microphone access denied or unsupported: ' + err.message);
        }
      } else {
        // Stop Recording
        isRecording = false;
        clearInterval(timerInterval);
        recordBtn.classList.remove('recording');
        recordBtn.disabled = true;
        statusText.className = 'status-text';
        statusText.textContent = '⏳ Processing and uploading audio...';

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }
    });

    async function uploadMeetingAudio(blob) {
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'meeting.webm');
        formData.append('title', titleInput.value.trim() || 'Executive Strategy Session');

        const res = await fetch('/api/meetings/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          statusText.className = 'status-text success';
          statusText.textContent = '✅ Meeting uploaded! Executive summary sent to your WhatsApp.';
          timerDisplay.textContent = '00:00:00';
          titleInput.value = '';
        } else {
          const err = await res.json();
          statusText.className = 'status-text';
          statusText.textContent = '❌ Upload failed: ' + (err.error || 'Server error');
        }
      } catch (err) {
        statusText.className = 'status-text';
        statusText.textContent = '❌ Network error uploading audio.';
      } finally {
        recordBtn.disabled = false;
      }
    }
  </script>
</body>
</html>
`;

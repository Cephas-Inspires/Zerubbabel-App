export const INIT_SCHEMA_SQL = `
-- SQLite Optimization
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. Contacts & Local Address Book
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  display_name TEXT,
  source TEXT DEFAULT 'whatsapp',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  notes TEXT,
  tags TEXT
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(display_name);

-- 2. Two-Stage WhatsApp Outbound Draft Queue
CREATE TABLE IF NOT EXISTS draft_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  draft_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'sent', 'rejected'
  created_at TEXT NOT NULL,
  approved_at TEXT,
  sent_at TEXT,
  failure_reason TEXT,
  source_context TEXT
);

CREATE INDEX IF NOT EXISTS idx_draft_status ON draft_queue(status);

-- 3. Group Rolling Memory (Last 30+ messages per active group)
CREATE TABLE IF NOT EXISTS group_buffer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  sender_jid TEXT NOT NULL,
  sender_name TEXT,
  message_text TEXT NOT NULL,
  message_timestamp INTEGER NOT NULL,
  is_zerub_tagged INTEGER DEFAULT 0,
  raw_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_group_buffer_jid_ts ON group_buffer(group_jid, message_timestamp DESC);

-- 4. Executive Habit Sentry Logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'skipped'
  log_date TEXT NOT NULL, -- YYYY-MM-DD
  response_notes TEXT,
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_key_date ON habit_logs(habit_key, log_date);

-- 5. Executive App Chat History (Cephas <-> Zerubbabel)
CREATE TABLE IF NOT EXISTS executive_chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  model_tier TEXT, -- 'tier1', 'tier2', 'tier3'
  created_at TEXT NOT NULL
);

-- 6. Meeting Ear Sessions & Google Docs Archive
CREATE TABLE IF NOT EXISTS meeting_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  audio_path TEXT,
  duration_seconds INTEGER DEFAULT 0,
  google_doc_id TEXT,
  google_doc_url TEXT,
  executive_summary TEXT,
  key_decisions TEXT,
  action_items TEXT,
  created_at TEXT NOT NULL
);

-- 7. System Settings & Runtime State
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Cephas Finance Tracker Logs (Offline Resilience & Fast Local Analytics)
CREATE TABLE IF NOT EXISTS finance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- YYYY-MM-DD
  month_year TEXT NOT NULL, -- e.g. "October 2026"
  item TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  notes TEXT,
  google_sheet_synced INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_logs(date);
CREATE INDEX IF NOT EXISTS idx_finance_month_year ON finance_logs(month_year);

-- 9. Spiritual Journal Reflections (8:30 AM Grounding)
CREATE TABLE IF NOT EXISTS spiritual_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  scripture_reference TEXT NOT NULL,
  key_themes TEXT,
  cephas_reflection TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Reading Notes Bank (3:30 PM Mental Mastery)
CREATE TABLE IF NOT EXISTS reading_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  book_title TEXT NOT NULL,
  chapter TEXT,
  key_framework TEXT,
  cephas_insight TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

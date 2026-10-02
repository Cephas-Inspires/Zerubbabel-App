import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { INIT_SCHEMA_SQL } from './schema.js';

let dbInstance: Database.Database | null = null;

export const getDatabase = (): Database.Database => {
  if (!dbInstance) {
    dbInstance = new Database(config.databasePath);
    // Execute initialization schema
    dbInstance.exec(INIT_SCHEMA_SQL);
  }
  return dbInstance;
};

// -----------------------------------------------------------------------------
// Contacts DAO
// -----------------------------------------------------------------------------
export interface ContactRecord {
  id?: number;
  phone_number: string;
  display_name: string | null;
  source?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  notes?: string | null;
  tags?: string | null;
}

export const upsertContact = (
  phone: string,
  name: string | null,
  source = 'whatsapp',
  notes: string | null = null,
  tags: string | null = null
): ContactRecord => {
  const db = getDatabase();
  const normalizedPhone = phone.replace(/\D/g, '');
  const now = new Date().toISOString();

  const existing = db
    .prepare('SELECT * FROM contacts WHERE phone_number = ?')
    .get(normalizedPhone) as ContactRecord | undefined;

  if (existing) {
    const updatedName = name && name.trim() !== '' ? name.trim() : existing.display_name;
    db.prepare(`
      UPDATE contacts 
      SET display_name = ?, last_seen_at = ?, notes = COALESCE(?, notes), tags = COALESCE(?, tags)
      WHERE phone_number = ?
    `).run(updatedName, now, notes, tags, normalizedPhone);

    return {
      ...existing,
      display_name: updatedName,
      last_seen_at: now
    };
  } else {
    const info = db.prepare(`
      INSERT INTO contacts (phone_number, display_name, source, first_seen_at, last_seen_at, notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(normalizedPhone, name?.trim() || null, source, now, now, notes, tags);

    return {
      id: Number(info.lastInsertRowid),
      phone_number: normalizedPhone,
      display_name: name?.trim() || null,
      source,
      first_seen_at: now,
      last_seen_at: now,
      notes,
      tags
    };
  }
};

export const searchContacts = (query: string): ContactRecord[] => {
  const db = getDatabase();
  const clean = `%${query.trim()}%`;
  return db
    .prepare('SELECT * FROM contacts WHERE display_name LIKE ? OR phone_number LIKE ? ORDER BY last_seen_at DESC LIMIT 10')
    .all(clean, clean) as ContactRecord[];
};

export const getAllContacts = (limit = 100, offset = 0): ContactRecord[] => {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM contacts ORDER BY last_seen_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as ContactRecord[];
};

// -----------------------------------------------------------------------------
// Two-Stage Draft Queue DAO
// -----------------------------------------------------------------------------
export interface DraftRecord {
  id: number;
  recipient_phone: string;
  recipient_name: string | null;
  draft_text: string;
  status: 'pending_approval' | 'approved' | 'sent' | 'rejected';
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  source_context: string | null;
}

export const createDraft = (
  recipientPhone: string,
  recipientName: string | null,
  draftText: string,
  sourceContext: string | null = null
): DraftRecord => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalizedPhone = recipientPhone.replace(/\D/g, '');

  const info = db.prepare(`
    INSERT INTO draft_queue (recipient_phone, recipient_name, draft_text, status, created_at, source_context)
    VALUES (?, ?, ?, 'pending_approval', ?, ?)
  `).run(normalizedPhone, recipientName, draftText, now, sourceContext);

  return {
    id: Number(info.lastInsertRowid),
    recipient_phone: normalizedPhone,
    recipient_name: recipientName,
    draft_text: draftText,
    status: 'pending_approval',
    created_at: now,
    approved_at: null,
    sent_at: null,
    failure_reason: null,
    source_context: sourceContext
  };
};

export const getPendingDrafts = (): DraftRecord[] => {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM draft_queue WHERE status = 'pending_approval' ORDER BY id DESC")
    .all() as DraftRecord[];
};

export const getDraftById = (id: number): DraftRecord | undefined => {
  const db = getDatabase();
  return db.prepare('SELECT * FROM draft_queue WHERE id = ?').get(id) as DraftRecord | undefined;
};

export const updateDraftStatus = (
  id: number,
  status: 'pending_approval' | 'approved' | 'sent' | 'rejected',
  failureReason: string | null = null
): void => {
  const db = getDatabase();
  const now = new Date().toISOString();
  if (status === 'approved') {
    db.prepare('UPDATE draft_queue SET status = ?, approved_at = ? WHERE id = ?').run(status, now, id);
  } else if (status === 'sent') {
    db.prepare('UPDATE draft_queue SET status = ?, sent_at = ? WHERE id = ?').run(status, now, id);
  } else {
    db.prepare('UPDATE draft_queue SET status = ?, failure_reason = ? WHERE id = ?').run(status, failureReason, id);
  }
};

export const updateDraftText = (id: number, newText: string): void => {
  const db = getDatabase();
  db.prepare('UPDATE draft_queue SET draft_text = ? WHERE id = ?').run(newText, id);
};

// -----------------------------------------------------------------------------
// Group Buffer DAO (Rolling 30+ Message Context)
// -----------------------------------------------------------------------------
export interface GroupMessageRecord {
  id?: number;
  group_jid: string;
  group_name: string | null;
  sender_jid: string;
  sender_name: string | null;
  message_text: string;
  message_timestamp: number;
  is_zerub_tagged: number;
  raw_message_id: string | null;
}

export const appendGroupMessage = (
  groupJid: string,
  groupName: string | null,
  senderJid: string,
  senderName: string | null,
  messageText: string,
  messageTimestamp: number,
  isZerubTagged: boolean,
  rawMessageId: string | null = null
): void => {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO group_buffer (group_jid, group_name, sender_jid, sender_name, message_text, message_timestamp, is_zerub_tagged, raw_message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(groupJid, groupName, senderJid, senderName, messageText, messageTimestamp, isZerubTagged ? 1 : 0, rawMessageId);

  // Keep circular buffer capped to last 50 entries per group
  db.prepare(`
    DELETE FROM group_buffer 
    WHERE group_jid = ? AND id NOT IN (
      SELECT id FROM group_buffer WHERE group_jid = ? ORDER BY message_timestamp DESC LIMIT 50
    )
  `).run(groupJid, groupJid);
};

export const getRecentGroupMessages = (groupJid: string, limit = 30): GroupMessageRecord[] => {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM group_buffer 
    WHERE group_jid = ? 
    ORDER BY message_timestamp DESC 
    LIMIT ?
  `).all(groupJid, limit) as GroupMessageRecord[];

  return rows.reverse(); // chronological order
};

// -----------------------------------------------------------------------------
// Executive Habit Sentry DAO
// -----------------------------------------------------------------------------
export interface HabitRecord {
  id?: number;
  habit_key: string;
  title: string;
  status: 'pending' | 'completed' | 'skipped';
  log_date: string;
  response_notes: string | null;
  completed_at: string | null;
}

export const upsertHabitLog = (
  habitKey: string,
  title: string,
  logDate: string,
  status: 'pending' | 'completed' | 'skipped',
  notes: string | null = null
): void => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO habit_logs (habit_key, title, status, log_date, response_notes, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(habit_key, log_date) DO UPDATE SET
      status = excluded.status,
      response_notes = COALESCE(excluded.response_notes, habit_logs.response_notes),
      completed_at = CASE WHEN excluded.status = 'completed' THEN ? ELSE habit_logs.completed_at END
  `).run(habitKey, title, status, logDate, notes, status === 'completed' ? now : null, now);
};

export const getHabitsForDate = (logDate: string): HabitRecord[] => {
  const db = getDatabase();
  return db.prepare('SELECT * FROM habit_logs WHERE log_date = ?').all(logDate) as HabitRecord[];
};

// -----------------------------------------------------------------------------
// Executive Chat History DAO
// -----------------------------------------------------------------------------
export interface ChatMessageRecord {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_tier?: 'tier1' | 'tier2' | 'tier3' | null;
  created_at?: string;
}

export const saveChatMessage = (
  role: 'user' | 'assistant' | 'system',
  content: string,
  modelTier: 'tier1' | 'tier2' | 'tier3' | null = null
): ChatMessageRecord => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO executive_chat_history (role, content, model_tier, created_at)
    VALUES (?, ?, ?, ?)
  `).run(role, content, modelTier, now);

  return {
    id: Number(info.lastInsertRowid),
    role,
    content,
    model_tier: modelTier,
    created_at: now
  };
};

export const getRecentChatHistory = (limit = 50): ChatMessageRecord[] => {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM executive_chat_history 
    ORDER BY id DESC 
    LIMIT ?
  `).all(limit) as ChatMessageRecord[];

  return rows.reverse();
};

// -----------------------------------------------------------------------------
// Meeting Ear Sessions DAO
// -----------------------------------------------------------------------------
export interface MeetingSessionRecord {
  id?: number;
  title: string;
  audio_path: string | null;
  duration_seconds: number;
  google_doc_id: string | null;
  google_doc_url: string | null;
  executive_summary: string | null;
  key_decisions: string | null;
  action_items: string | null;
  created_at: string;
}

export const createMeetingSession = (
  title: string,
  audioPath: string | null,
  durationSeconds: number,
  docId: string | null = null,
  docUrl: string | null = null,
  summary: string | null = null,
  decisions: string | null = null,
  actionItems: string | null = null
): MeetingSessionRecord => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO meeting_sessions (title, audio_path, duration_seconds, google_doc_id, google_doc_url, executive_summary, key_decisions, action_items, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, audioPath, durationSeconds, docId, docUrl, summary, decisions, actionItems, now);

  return {
    id: Number(info.lastInsertRowid),
    title,
    audio_path: audioPath,
    duration_seconds: durationSeconds,
    google_doc_id: docId,
    google_doc_url: docUrl,
    executive_summary: summary,
    key_decisions: decisions,
    action_items: actionItems,
    created_at: now
  };
};

export const getMeetingSessions = (limit = 20): MeetingSessionRecord[] => {
  const db = getDatabase();
  return db.prepare('SELECT * FROM meeting_sessions ORDER BY id DESC LIMIT ?').all(limit) as MeetingSessionRecord[];
};

// -----------------------------------------------------------------------------
// System Settings DAO
// -----------------------------------------------------------------------------
export const setSetting = (key: string, value: string): void => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
};

export const getSetting = (key: string): string | null => {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
};

import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { INIT_SCHEMA_SQL } from './schema.js';
let dbInstance = null;
export const getDatabase = () => {
    if (!dbInstance) {
        dbInstance = new Database(config.databasePath);
        // Execute initialization schema
        dbInstance.exec(INIT_SCHEMA_SQL);
    }
    return dbInstance;
};
export const upsertContact = (phone, name, source = 'whatsapp', notes = null, tags = null) => {
    const db = getDatabase();
    const normalizedPhone = phone.replace(/\D/g, '');
    const now = new Date().toISOString();
    const existing = db
        .prepare('SELECT * FROM contacts WHERE phone_number = ?')
        .get(normalizedPhone);
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
    }
    else {
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
export const searchContacts = (query) => {
    const db = getDatabase();
    const clean = `%${query.trim()}%`;
    return db
        .prepare('SELECT * FROM contacts WHERE display_name LIKE ? OR phone_number LIKE ? ORDER BY last_seen_at DESC LIMIT 10')
        .all(clean, clean);
};
export const getAllContacts = (limit = 100, offset = 0) => {
    const db = getDatabase();
    return db
        .prepare('SELECT * FROM contacts ORDER BY last_seen_at DESC LIMIT ? OFFSET ?')
        .all(limit, offset);
};
export const createDraft = (recipientPhone, recipientName, draftText, sourceContext = null) => {
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
export const getPendingDrafts = () => {
    const db = getDatabase();
    return db
        .prepare("SELECT * FROM draft_queue WHERE status = 'pending_approval' ORDER BY id DESC")
        .all();
};
export const getDraftById = (id) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM draft_queue WHERE id = ?').get(id);
};
export const updateDraftStatus = (id, status, failureReason = null) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    if (status === 'approved') {
        db.prepare('UPDATE draft_queue SET status = ?, approved_at = ? WHERE id = ?').run(status, now, id);
    }
    else if (status === 'sent') {
        db.prepare('UPDATE draft_queue SET status = ?, sent_at = ? WHERE id = ?').run(status, now, id);
    }
    else {
        db.prepare('UPDATE draft_queue SET status = ?, failure_reason = ? WHERE id = ?').run(status, failureReason, id);
    }
};
export const updateDraftText = (id, newText) => {
    const db = getDatabase();
    db.prepare('UPDATE draft_queue SET draft_text = ? WHERE id = ?').run(newText, id);
};
export const appendGroupMessage = (groupJid, groupName, senderJid, senderName, messageText, messageTimestamp, isZerubTagged, rawMessageId = null) => {
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
export const getRecentGroupMessages = (groupJid, limit = 30) => {
    const db = getDatabase();
    const rows = db.prepare(`
    SELECT * FROM group_buffer 
    WHERE group_jid = ? 
    ORDER BY message_timestamp DESC 
    LIMIT ?
  `).all(groupJid, limit);
    return rows.reverse(); // chronological order
};
export const upsertHabitLog = (habitKey, title, logDate, status, notes = null) => {
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
export const getHabitsForDate = (logDate) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM habit_logs WHERE log_date = ?').all(logDate);
};
export const saveChatMessage = (role, content, modelTier = null) => {
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
export const getRecentChatHistory = (limit = 50) => {
    const db = getDatabase();
    const rows = db.prepare(`
    SELECT * FROM executive_chat_history 
    ORDER BY id DESC 
    LIMIT ?
  `).all(limit);
    return rows.reverse();
};
export const createMeetingSession = (title, audioPath, durationSeconds, docId = null, docUrl = null, summary = null, decisions = null, actionItems = null) => {
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
export const getMeetingSessions = (limit = 20) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM meeting_sessions ORDER BY id DESC LIMIT ?').all(limit);
};
// -----------------------------------------------------------------------------
// System Settings DAO
// -----------------------------------------------------------------------------
export const setSetting = (key, value) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
};
export const getSetting = (key) => {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    return row ? row.value : null;
};
export const logExpense = (date, monthYear, item, category, amount, currency = 'NGN', notes = null, synced = false) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const info = db.prepare(`
    INSERT INTO finance_logs (date, month_year, item, category, amount, currency, notes, google_sheet_synced, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, monthYear, item, category, amount, currency.toUpperCase(), notes, synced ? 1 : 0, now);
    return {
        id: Number(info.lastInsertRowid),
        date,
        month_year: monthYear,
        item,
        category,
        amount,
        currency: currency.toUpperCase(),
        notes,
        google_sheet_synced: synced ? 1 : 0,
        created_at: now
    };
};
export const getExpensesForRange = (startDate, endDate) => {
    const db = getDatabase();
    return db
        .prepare('SELECT * FROM finance_logs WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC')
        .all(startDate, endDate);
};
export const getExpensesForMonth = (monthYear) => {
    const db = getDatabase();
    return db
        .prepare('SELECT * FROM finance_logs WHERE month_year = ? ORDER BY date DESC, id DESC')
        .all(monthYear);
};
export const markExpenseSynced = (id) => {
    const db = getDatabase();
    db.prepare('UPDATE finance_logs SET google_sheet_synced = 1 WHERE id = ?').run(id);
};

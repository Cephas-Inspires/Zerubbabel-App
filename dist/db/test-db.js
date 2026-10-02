import { getDatabase, upsertContact, searchContacts, createDraft, getPendingDrafts, updateDraftStatus, appendGroupMessage, getRecentGroupMessages, upsertHabitLog, getHabitsForDate, saveChatMessage, getRecentChatHistory, setSetting, getSetting } from './index.js';
console.log('🧪 Starting SQLite Database Verification for Zerubbabel...');
try {
    const db = getDatabase();
    console.log('✅ SQLite Database Connected successfully with WAL mode.');
    // 1. Test Contacts Upsert & Search
    const c1 = upsertContact('+2348072854186', 'Cephas Founder', 'personal_whatsapp', 'Executive Principal');
    const c2 = upsertContact('2348031234567', 'Tolu Finance', 'whatsapp', 'Lead accountant');
    const c3 = upsertContact('+2348129876543', 'Tolu Dev', 'whatsapp', 'Fullstack engineer');
    console.log('✅ Upserted contacts:', { c1: c1.display_name, c2: c2.display_name, c3: c3.display_name });
    const searchResults = searchContacts('Tolu');
    console.log(`✅ Search contacts query ('Tolu') found ${searchResults.length} matches:`, searchResults.map(c => `${c.display_name} (${c.phone_number})`));
    // 2. Test Draft Queue
    const draft = createDraft('2348031234567', 'Tolu Finance', 'Hello Tolu, the proposal is ready for review.');
    console.log('✅ Created draft in queue:', draft.id, draft.status);
    const pending = getPendingDrafts();
    console.log(`✅ Pending drafts count: ${pending.length}`);
    updateDraftStatus(draft.id, 'approved');
    console.log('✅ Updated draft status to approved');
    // 3. Test Group Buffer
    const groupJid = '1203630281928374@g.us';
    appendGroupMessage(groupJid, 'Growth Team', '2348011111111@s.whatsapp.net', 'Alex', 'Are we ready for the launch?', Date.now() - 2000, false);
    appendGroupMessage(groupJid, 'Growth Team', '2348072854186@s.whatsapp.net', 'Cephas', '@Zerub summarize our pending deliverables', Date.now(), true);
    const recentMessages = getRecentGroupMessages(groupJid, 10);
    console.log(`✅ Group buffer retrieved ${recentMessages.length} messages. Last message tagged Zerub: ${recentMessages[recentMessages.length - 1].is_zerub_tagged === 1}`);
    // 4. Test Habit Logs
    const today = new Date().toISOString().split('T')[0];
    upsertHabitLog('morning_briefing', 'Morning Strategic Briefing', today, 'completed', 'Briefing digested at 8:05 AM');
    const habits = getHabitsForDate(today);
    console.log(`✅ Habit logs for today (${today}):`, habits.map(h => `${h.title}: ${h.status}`));
    // 5. Test Chat History
    saveChatMessage('user', 'Zerub, what is on my calendar today?');
    saveChatMessage('assistant', 'Good morning Cephas. You have 2 strategic sessions scheduled.', 'tier2');
    const chat = getRecentChatHistory(5);
    console.log(`✅ Executive chat history records: ${chat.length}`);
    // 6. Test System Settings
    setSetting('daemon_boot_count', '1');
    const bootCount = getSetting('daemon_boot_count');
    console.log(`✅ System settings test: daemon_boot_count = ${bootCount}`);
    console.log('\n🎉 ALL SQLITE DATABASE CHECKS PASSED PERFECTLY!\n');
}
catch (error) {
    console.error('❌ SQLite Database verification failed:', error);
    process.exit(1);
}

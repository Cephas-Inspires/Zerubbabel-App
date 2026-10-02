import { ExecutiveSchedulerService } from './schedulers.js';
import { getHabitScoreForDate, saveSpiritualJournal, getSpiritualJournals, saveReadingNote, getReadingNotes, upsertHabitLog } from '../db/index.js';
async function testBriefingsAndHabitsSpec() {
    console.log('🧪 Testing Executive Briefings & Habits Engine (SPEC Verification)...');
    const todayStr = new Date().toISOString().split('T')[0];
    // 1. Test Habit Logging & Score
    console.log('\n--- 1. Testing Habit Tracking ---');
    upsertHabitLog('spiritual_grounding', 'Spiritual Grounding', todayStr, 'completed', 'Proverbs 16');
    upsertHabitLog('physical_replenishment', 'Midday Lunch', todayStr, 'completed', 'Lunch & hydration');
    upsertHabitLog('mental_mastery', 'Book Reading', todayStr, 'completed', 'Zero to One Ch. 4');
    upsertHabitLog('fitness_workout', 'Evening Workout', todayStr, 'completed', 'Gym session');
    upsertHabitLog('daily_expense_checkin', 'Finance Check-in', todayStr, 'completed', '₦93,000 logged');
    const scoreSummary = getHabitScoreForDate(todayStr);
    console.log(`✅ Habit Score for ${todayStr}: ${scoreSummary.score}/${scoreSummary.total}`);
    if (scoreSummary.score !== 5) {
        throw new Error(`Expected score 5, got ${scoreSummary.score}`);
    }
    // 2. Test Spiritual Journal
    console.log('\n--- 2. Testing Spiritual Journal Storage ---');
    const journal = saveSpiritualJournal(todayStr, 'Proverbs 16:3, 9', 'Sovereignty and Planning', 'Where do you feel the most discernment between human planning and divine alignment?');
    console.log('✅ Spiritual journal entry saved:', journal.scripture_reference);
    const journals = getSpiritualJournals(1);
    console.log(`✅ Retrieved journal: "${journals[0].scripture_reference}" - "${journals[0].key_themes}"`);
    // 3. Test Reading Notes
    console.log('\n--- 3. Testing Reading Notes Bank ---');
    const note = saveReadingNote(todayStr, 'Zero to One by Peter Thiel', 'Chapter 4: Monopoly vs Competition', 'Creative Monopolies generate economic profit by escaping competition', 'Focus on owning our specialized niche rather than commodity racing');
    console.log('✅ Reading note saved:', note.book_title);
    const notes = getReadingNotes(1);
    console.log(`✅ Retrieved reading note: "${notes[0].book_title}" - "${notes[0].chapter}"`);
    // 4. Test Schedulers instantiation & message generation
    console.log('\n--- 4. Testing Schedulers Message Generation ---');
    const scheduler = new ExecutiveSchedulerService();
    console.log('• Testing Spiritual Grounding prompt...');
    const spiritualMsg = await scheduler.runSpiritualGrounding();
    console.log(spiritualMsg.substring(0, 80) + '...');
    console.log('• Testing Physical Replenishment prompt...');
    const physicalMsg = await scheduler.runPhysicalReplenishment();
    console.log(physicalMsg.substring(0, 80) + '...');
    console.log('• Testing Mental Mastery prompt...');
    const readingMsg = await scheduler.runMentalMastery();
    console.log(readingMsg.substring(0, 80) + '...');
    console.log('• Testing Fitness prompt...');
    const fitnessMsg = await scheduler.runFitnessMovement();
    console.log(fitnessMsg.substring(0, 80) + '...');
    console.log('• Testing Finance checkin prompt...');
    const financeMsg = await scheduler.runFinanceCheckin();
    console.log(financeMsg.substring(0, 80) + '...');
    console.log('• Testing Evening Debrief generation...');
    const debriefMsg = await scheduler.runEveningDebrief();
    console.log('Debrief message:\n', debriefMsg);
    console.log('\n🎉 ALL BRIEFINGS & HABITS SPEC TESTS PASSED SUCCESSFULLY!');
}
testBriefingsAndHabitsSpec().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

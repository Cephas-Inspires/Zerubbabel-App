import { financeTracker } from './finance-tracker.js';
import { ExecutiveSchedulerService } from './schedulers.js';
import { getExpensesForMonth } from '../db/index.js';
import { GoogleAuthManager } from '../google/auth.js';
console.log('🧪 Starting Step 5 Verification: Google Workspace Suite, Finance Tracker & Executive Schedulers...\n');
async function runStep5Tests() {
    const currentMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    // 1. Test Natural Language Expense Parsing
    console.log('💰 [1/4] Testing Natural Language Expense Parsing (Finance Tracker)...');
    const sampleInput = 'Spent 15k on fuel at Total, 4500 on lunch at Ogeez, and $20 for server subscription';
    console.log(`Input: "${sampleInput}"`);
    const parsedItems = await financeTracker.parseExpenses(sampleInput);
    console.log('Parsed Items:', JSON.stringify(parsedItems, null, 2));
    if (parsedItems.length !== 3) {
        throw new Error(`Expected 3 expense items, got ${parsedItems.length}`);
    }
    const fuel = parsedItems.find(p => p.item.toLowerCase().includes('fuel'));
    const lunch = parsedItems.find(p => p.item.toLowerCase().includes('lunch'));
    const sub = parsedItems.find(p => p.currency === 'USD');
    if (!fuel || fuel.amount !== 15000)
        throw new Error('Fuel amount parsing failed (expected 15000)');
    if (!lunch || lunch.amount !== 4500)
        throw new Error('Lunch amount parsing failed (expected 4500)');
    if (!sub || sub.amount !== 20)
        throw new Error('USD subscription parsing failed (expected 20)');
    console.log('✅ Natural language currency & amount parsing verified.\n');
    // 2. Test SQLite Finance Logging & Monthly Tab Aggregation
    console.log(`📊 [2/4] Testing SQLite Expense Logging for ${currentMonthYear}...`);
    const logResult = await financeTracker.logExpenses(parsedItems);
    console.log('Log summary:\n', logResult.summaryText);
    const monthExpenses = getExpensesForMonth(currentMonthYear);
    console.log(`✅ SQLite records in ${currentMonthYear}: ${monthExpenses.length} entries.`);
    if (monthExpenses.length < 3)
        throw new Error('Failed to record expenses in SQLite');
    console.log('✅ Local SQLite finance storage & monthly grouping verified.\n');
    // 3. Test Saturday 10:00 PM Weekly Financial Breakdown Synthesis
    console.log('📈 [3/4] Testing Weekly Financial Executive Report Generation...');
    const weeklyReport = await financeTracker.generateWeeklyReport();
    console.log('\n--- WEEKLY FINANCIAL EXECUTIVE REPORT ---');
    console.log(weeklyReport);
    console.log('-----------------------------------------\n');
    if (!weeklyReport || weeklyReport.length < 50) {
        throw new Error('Weekly report generation returned empty response');
    }
    console.log('✅ Weekly financial synthesis verified.\n');
    // 4. Test Executive Schedulers & Sentry Routines
    console.log('⏰ [4/4] Testing Executive Schedulers (Morning Briefing & Evening Debrief)...');
    const schedulers = new ExecutiveSchedulerService();
    console.log('Testing Morning Strategic Briefing generation...');
    const briefing = await schedulers.runMorningBriefing();
    console.log('\n--- MORNING STRATEGIC BRIEFING ---');
    console.log(briefing);
    console.log('----------------------------------\n');
    console.log('Testing Evening Strategic Debrief generation...');
    const debrief = await schedulers.runEveningDebrief();
    console.log('\n--- EVENING STRATEGIC DEBRIEF ---');
    console.log(debrief);
    console.log('---------------------------------\n');
    console.log(`Google Auth Configured: ${GoogleAuthManager.isConfigured()}`);
    console.log('🎉 ALL STEP 5 TESTS PASSED PERFECTLY!\n');
}
runStep5Tests().catch(err => {
    console.error('❌ Step 5 test failed:', err);
    process.exit(1);
});

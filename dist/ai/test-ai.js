import { aiRouter } from './router.js';
import { config } from '../config/index.js';
console.log('🤖 Testing Multi-Model AI Router Architecture...');
// 1. Verify routing logic across all tiers
const testCases = [
    { task: 'triage', expectedTier: 'tier1' },
    { task: 'intent_classification', expectedTier: 'tier1' },
    { task: 'name_disambiguation', expectedTier: 'tier1' },
    { task: 'executive_chat', expectedTier: 'tier2' },
    { task: 'draft_generation', expectedTier: 'tier2' },
    { task: 'group_reply', expectedTier: 'tier2' },
    { task: 'meeting_audio_synthesis', expectedTier: 'tier3' },
    { task: 'strategic_debrief', expectedTier: 'tier3' }
];
let allPassed = true;
for (const tc of testCases) {
    const resolved = aiRouter.resolveTierForTask(tc.task);
    const model = aiRouter.getModelName(resolved);
    const pass = resolved === tc.expectedTier;
    console.log(`[Task: ${tc.task.padEnd(24)}] -> Tier: ${resolved} (${model}) | ${pass ? '✅ PASS' : '❌ FAIL'}`);
    if (!pass)
        allPassed = false;
}
if (!allPassed) {
    console.error('❌ Task complexity tier mapping failed!');
    process.exit(1);
}
console.log('✅ All complexity tier routing rules validated.');
// 2. Check API key status
if (config.geminiApiKey && config.geminiApiKey !== 'your_gemini_api_key_here') {
    console.log('🔑 Gemini API key detected. Running live test call on Tier 1 (Flash-Lite)...');
    aiRouter.executeTask('triage', 'Hello Zerubbabel, confirm system readiness.')
        .then(res => {
        console.log(`✅ Live Gemini call succeeded on ${res.actualTier} (${res.modelUsed}):\n${res.text}`);
    })
        .catch(err => {
        console.warn('⚠️ Gemini live call returned error (verify key permissions):', err.message);
    });
}
else {
    console.log('ℹ️ GEMINI_API_KEY is not configured yet in .env (waiting for Cephas key). Routing architecture is verified.');
}

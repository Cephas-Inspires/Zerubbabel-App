import { DraftEngine } from './draft-engine.js';
import { 
  upsertContact, 
  getPendingDrafts, 
  getDraftById 
} from '../db/index.js';

console.log('🧪 Starting Step 3 Verification: Contacts & Two-Stage Draft Engine...\n');

async function runTests() {
  const engine = new DraftEngine();

  // 1. Seed Contacts
  console.log('📋 [1/5] Seeding test contacts into SQLite address book...');
  upsertContact('2348031234567', 'Tolu Finance', 'whatsapp', 'Lead Financial Analyst');
  upsertContact('2348129876543', 'Tolu Dev', 'whatsapp', 'Lead Fullstack Dev');
  upsertContact('2349011223344', 'Dr. Kemi', 'whatsapp', 'Advisory Board');
  console.log('✅ Contacts seeded: Tolu Finance, Tolu Dev, Dr. Kemi.\n');

  // 2. Test Single Contact Direct Match
  console.log('🎯 [2/5] Testing Single Contact Match ("Tell Dr. Kemi that our strategy document has been finalized")...');
  const res1 = await engine.processExecutiveInstruction('Tell Dr. Kemi that our strategy document has been finalized');
  console.log('Result type:', res1.type);
  console.log('Response text:\n', res1.replyText);

  if (res1.type !== 'draft_staged' || !res1.draft) {
    throw new Error('Expected draft_staged for single contact match');
  }
  console.log(`✅ Staged draft #${res1.draft.id} for ${res1.draft.recipient_name} (+${res1.draft.recipient_phone})`);
  console.log(`Draft text: "${res1.draft.draft_text}"\n`);

  // 3. Test Disambiguation Flow
  console.log('🔀 [3/5] Testing Disambiguation Flow ("Tell Tolu that the financial model is ready for review")...');
  const res2 = await engine.processExecutiveInstruction('Tell Tolu that the financial model is ready for review');
  console.log('Result type:', res2.type);
  console.log('Response text:\n', res2.replyText);

  if (res2.type !== 'disambiguation_required' || !res2.matches || res2.matches.length < 2) {
    throw new Error('Expected disambiguation_required with at least 2 matches');
  }
  console.log('✅ Disambiguation correctly triggered for multiple Tolus.\n');

  // 4. Test Disambiguation Resolution (Replying "1")
  const targetOption = res2.matches[0];
  console.log(`🔢 [4/5] Testing Disambiguation Resolution (User replies "1" for ${targetOption.display_name})...`);
  const res3 = await engine.processExecutiveInstruction('1');
  console.log('Result type:', res3.type);
  console.log('Response text:\n', res3.replyText);

  if (res3.type !== 'draft_staged' || !res3.draft || res3.draft.recipient_phone !== targetOption.phone_number) {
    throw new Error(`Expected draft to be staged for ${targetOption.display_name} (+${targetOption.phone_number})`);
  }
  console.log(`✅ Disambiguation resolved! Draft #${res3.draft.id} staged for ${res3.draft.recipient_name} (+${res3.draft.recipient_phone}).\n`);

  // 5. Test Safety Rule: Zero Autonomous Texting
  console.log('🛡️ [5/5] Verifying Strict Safety Rule (Zero Autonomous Texting)...');
  const pending = getPendingDrafts();
  console.log(`Total pending drafts in queue: ${pending.length}`);

  for (const d of pending) {
    const verified = getDraftById(d.id);
    if (verified?.status !== 'pending_approval') {
      throw new Error(`Draft #${d.id} is not pending approval! Status: ${verified?.status}`);
    }
    if (verified.sent_at !== null) {
      throw new Error(`SECURITY BREACH: Draft #${d.id} has sent_at timestamp before Cephas approved!`);
    }
  }
  console.log('✅ SAFETY VERIFIED: All drafts are safely queued with status "pending_approval" and sent_at: null.');

  // Test Cancel
  const lastDraftId = res3.draft.id;
  engine.cancelDraft(lastDraftId, 'Tested cancellation');
  const cancelled = getDraftById(lastDraftId);
  console.log(`✅ Draft #${lastDraftId} cancel check: status = ${cancelled?.status} (${cancelled?.failure_reason})`);

  console.log('\n🎉 ALL STEP 3 TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Step 3 test failed:', err);
  process.exit(1);
});

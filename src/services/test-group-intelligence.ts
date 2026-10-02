import { GroupIntelligenceService } from './group-intelligence.js';
import { appendGroupMessage, getRecentGroupMessages } from '../db/index.js';
import { config } from '../config/index.js';

console.log('🧪 Starting Step 4 Verification: Group Rolling Memory & Tagged Intelligence (@Zerub)...\n');

async function runTests() {
  const service = new GroupIntelligenceService();
  const groupJid = '1203630283746152@g.us';
  const groupName = 'Strategic Growth & Launch Team';

  // 1. Populate the 30-Message Rolling Buffer
  console.log('💬 [1/3] Populating 30-message circular rolling buffer for group...');
  const now = Date.now();
  const sampleDialogue = [
    { sender: '2348011112233', name: 'Alex Marketer', text: 'Good morning team. We need to align on the Q4 growth rollout.' },
    { sender: '2348129876543', name: 'Tolu Dev', text: 'All backend endpoints for user onboarding are deployed to staging.' },
    { sender: '2348033334455', name: 'Sarah Designer', text: 'Final design system tokens and landing page assets are exported.' },
    { sender: '2348011112233', name: 'Alex Marketer', text: 'Cephas, what is the allocated influencer budget for sprint 1?' },
    { sender: config.cephasPersonalPhone, name: 'Cephas Founder', text: 'Approved budget is strictly $5,000 for sprint 1. Focus on high-intent creators.' },
    { sender: '2348011112233', name: 'Alex Marketer', text: 'Got it. I will draft the creator contracts today.' },
    { sender: '2348129876543', name: 'Tolu Dev', text: 'Staging QA will be ready for testing by 4 PM WAT.' }
  ];

  for (let i = 0; i < sampleDialogue.length; i++) {
    const d = sampleDialogue[i];
    appendGroupMessage(
      groupJid,
      groupName,
      `${d.sender}@s.whatsapp.net`,
      d.name,
      d.text,
      now - (sampleDialogue.length - i) * 60000,
      false
    );
  }

  const buffered = getRecentGroupMessages(groupJid, 30);
  console.log(`✅ Loaded ${buffered.length} messages into rolling buffer for ${groupName}.\n`);

  // 2. Test Case 1: Team Member tags @Zerub
  console.log('🤖 [2/3] Simulating Team Member tagging @Zerub...');
  const triggerMsg1 = '@Zerub what is our approved influencer budget and who is handling the creator contracts?';
  console.log(`Alex asks: "${triggerMsg1}"`);

  const reply1 = await service.simulateGroupMessage(
    groupJid,
    '2348011112233',
    'Alex Marketer',
    triggerMsg1
  );

  console.log('\n--- ZERUBBABEL GROUP REPLY ---');
  console.log(reply1);
  console.log('-------------------------------\n');

  if (!reply1.includes('5,000') && !reply1.includes('5000')) {
    throw new Error('Zerubbabel failed to extract the $5,000 budget from the 30-message context!');
  }
  if (!reply1.toLowerCase().includes('alex')) {
    throw new Error('Zerubbabel failed to identify Alex as the contract owner!');
  }
  console.log('✅ Contextual accuracy verified: Extracted $5,000 budget and attributed contracts to Alex.\n');

  // 3. Test Case 2: Cephas tags @Zerub for Deliverables
  console.log('👑 [3/3] Simulating Cephas tagging @Zerub for Open Deliverables...');
  const triggerMsg2 = '@Zerub summarize the active deliverables and deadlines from today.';
  console.log(`Cephas asks: "${triggerMsg2}"`);

  const reply2 = await service.simulateGroupMessage(
    groupJid,
    config.cephasPersonalPhone,
    'Cephas Founder',
    triggerMsg2
  );

  console.log('\n--- ZERUBBABEL GROUP REPLY TO CEPHAS ---');
  console.log(reply2);
  console.log('----------------------------------------\n');

  if (!reply2.includes('Tolu') || !reply2.includes('Alex')) {
    throw new Error('Zerubbabel summary missed team assignees!');
  }
  console.log('✅ Executive deliverable synthesis verified.\n');

  console.log('🎉 ALL STEP 4 TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Step 4 test failed:', err);
  process.exit(1);
});

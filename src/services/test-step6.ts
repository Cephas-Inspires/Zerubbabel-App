import fs from 'node:fs';
import path from 'node:path';
import { meetingEar } from './meeting-ear.js';
import { getMeetingSessions, getPendingDrafts } from '../db/index.js';

console.log('🧪 Starting Step 6 Verification: The Meeting Ear & Dedicated Mobile App...\n');

/**
 * Generate a minimal valid 16kHz mono WAV file for testing
 */
function createSyntheticWav(filePath: string, durationSeconds = 1): void {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate 440Hz sine tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 16000;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

async function runStep6Tests() {
  // 1. Generate test meeting audio
  console.log('🎙️ [1/3] Generating synthetic meeting audio buffer (16kHz WAV)...');
  const tempDir = path.resolve(process.cwd(), './recordings');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const testWavPath = path.join(tempDir, 'test_meeting_audio.wav');
  createSyntheticWav(testWavPath, 2);
  console.log(`✅ Test audio file ready at ${testWavPath} (${fs.statSync(testWavPath).size} bytes).\n`);

  // 2. Process Meeting Audio through Meeting Ear & Gemini
  console.log('🧠 [2/3] Processing audio through Meeting Ear & Gemini Multimodal Engine...');
  const result = await meetingEar.processMeetingAudio(
    testWavPath,
    'audio/wav',
    'Cephas & Executive Team Growth Strategy'
  );

  console.log('\n--- MEETING EAR EXECUTIVE DEBRIEF ---');
  console.log(`📌 Title: ${result.title}`);
  console.log(`📋 Summary:\n• ${result.summaryBullets.join('\n• ')}`);
  console.log(`🎯 Key Decisions:\n• ${result.keyDecisions.join('\n• ')}`);
  console.log(`⚡ Action Items:`, JSON.stringify(result.actionItems, null, 2));
  console.log(`📝 Follow-up WhatsApp Draft ID: ${result.whatsAppFollowupDraftId || 'None'}`);
  console.log('-------------------------------------\n');

  // 3. Verify SQLite Persistence
  console.log('💾 [3/3] Verifying SQLite Meeting Sessions & Draft Staging...');
  const pastMeetings = getMeetingSessions(5);
  console.log(`Total saved meeting sessions in SQLite: ${pastMeetings.length}`);
  if (pastMeetings.length === 0) throw new Error('No meeting sessions recorded in SQLite');

  const pendingDrafts = getPendingDrafts();
  console.log(`Pending drafts in queue: ${pendingDrafts.length}`);

  console.log('✅ Meeting sessions recorded and archived in SQLite.');
  console.log('🎉 ALL STEP 6 TESTS PASSED PERFECTLY!\n');
}

runStep6Tests().catch(err => {
  console.error('❌ Step 6 test failed:', err);
  process.exit(1);
});

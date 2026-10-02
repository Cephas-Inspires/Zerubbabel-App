import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import { createMeetingSession, createDraft } from '../db/index.js';
import { GoogleWorkspaceTools } from '../google/workspace-tools.js';
import { GoogleAuthManager } from '../google/auth.js';
export class MeetingEarService {
    ai;
    constructor() {
        this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
    /**
     * Ingest audio recording, synthesize minutes via Gemini Multimodal Audio, and archive
     */
    async processMeetingAudio(audioFilePath, mimeType = 'audio/mp3', titleHint = 'Strategic Discussion') {
        console.log(`🎙️ [Meeting Ear] Processing meeting audio file: ${audioFilePath} (${mimeType})...`);
        if (!fs.existsSync(audioFilePath)) {
            throw new Error(`Audio file not found: ${audioFilePath}`);
        }
        const audioBuffer = fs.readFileSync(audioFilePath);
        const audioBase64 = audioBuffer.toString('base64');
        const stats = fs.statSync(audioFilePath);
        const durationEstimateSeconds = Math.max(10, Math.floor(stats.size / 16000)); // rough estimate
        const systemPrompt = `You are Zerubbabel, Chief of Staff to Cephas (Founder & Strategic Leader).
You are analyzing audio from a recorded meeting (Zoom, Google Meet, phone call, or in-person room discussion).
Extract all commitments, decisions, and action items with relentless executive precision.

Return ONLY a valid JSON object matching this schema:
{
  "title": "string (Meeting Summary - [Topic/Attendees] - [Date])",
  "attendees": ["string"],
  "summary_bullets": ["string (Core takeaway 1)", "string (Core takeaway 2)", "string (Core takeaway 3)"],
  "key_decisions": ["string (Explicit agreement 1)", "string (Explicit agreement 2)"],
  "action_items": [
    {
      "task": "string",
      "owner": "string",
      "deadline": "string"
    }
  ],
  "full_minutes_markdown": "string (Comprehensive formatted minutes suitable for Google Docs)",
  "whatsapp_followup": "string (A polite, concise wrap-up WhatsApp message summarizing next steps to attendees)"
}`;
        // Send audio buffer to Gemini Multimodal Audio (Tier 2/3 Flash/Pro)
        const response = await this.ai.models.generateContent({
            model: config.modelTier2Workhorse,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Analyze this recorded meeting. Meeting context hint: "${titleHint}". Extract executive minutes.`
                        },
                        {
                            inlineData: {
                                data: audioBase64,
                                mimeType
                            }
                        }
                    ]
                }
            ],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2
            }
        });
        const text = response.text || '';
        let parsed = {};
        try {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            }
            else {
                throw new Error('No JSON found in Gemini audio response');
            }
        }
        catch (parseErr) {
            console.warn('⚠️ JSON parsing failed on meeting response, using structured fallback:', text);
            parsed = {
                title: `Meeting Summary - ${titleHint} - ${new Date().toISOString().split('T')[0]}`,
                attendees: ['Cephas', 'Participants'],
                summary_bullets: [text.slice(0, 200)],
                key_decisions: ['Reviewed strategic roadmap.'],
                action_items: [{ task: 'Follow up on discussion items', owner: 'Team', deadline: 'End of week' }],
                full_minutes_markdown: text,
                whatsapp_followup: 'Thank you all for the discussion. Next steps will be circulated shortly.'
            };
        }
        const meetingTitle = parsed.title || `Meeting Summary - ${titleHint} - ${new Date().toISOString().split('T')[0]}`;
        const summaryBullets = parsed.summary_bullets || [];
        const keyDecisions = parsed.key_decisions || [];
        const actionItems = parsed.action_items || [];
        // 1. Google Docs & Drive Archive
        let docId = null;
        let docUrl = null;
        if (GoogleAuthManager.isConfigured()) {
            try {
                console.log(`📄 [Meeting Ear] Creating Google Doc in "${config.googleDriveMeetingFolderName}" folder...`);
                const docResult = await GoogleWorkspaceTools.createGoogleDoc(meetingTitle, parsed.full_minutes_markdown || text);
                docId = docResult.docId;
                docUrl = docResult.url;
                console.log(`✅ [Meeting Ear] Google Doc created: ${docUrl}`);
            }
            catch (docErr) {
                console.warn('⚠️ Failed to create Google Doc in Drive:', docErr?.message || docErr);
            }
        }
        // 2. Local Markdown Backup
        const backupDir = path.resolve(process.cwd(), './data/meetings');
        if (!fs.existsSync(backupDir))
            fs.mkdirSync(backupDir, { recursive: true });
        const localMarkdownPath = path.join(backupDir, `${Date.now()}_meeting.md`);
        fs.writeFileSync(localMarkdownPath, parsed.full_minutes_markdown || text, 'utf-8');
        // 3. Stage WhatsApp Follow-Up Draft in SQLite Queue
        let draftId;
        if (parsed.whatsapp_followup) {
            const draft = createDraft(config.cephasPersonalPhone, // Default to Cephas line or group for review
            'Meeting Attendees', parsed.whatsapp_followup, `Auto-generated follow-up from meeting: ${meetingTitle}`);
            draftId = draft.id;
        }
        // 4. Record to SQLite meeting_sessions
        const session = createMeetingSession(meetingTitle, audioFilePath, durationEstimateSeconds, docId, docUrl, summaryBullets.join('\n• '), keyDecisions.join('\n• '), JSON.stringify(actionItems));
        return {
            session,
            title: meetingTitle,
            summaryBullets,
            keyDecisions,
            actionItems,
            googleDocUrl: docUrl,
            whatsAppFollowupDraftId: draftId
        };
    }
}
export const meetingEar = new MeetingEarService();

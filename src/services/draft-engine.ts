import { aiRouter } from '../ai/router.js';
import { 
  searchContacts, 
  upsertContact, 
  createDraft, 
  getPendingDrafts, 
  getDraftById, 
  updateDraftStatus, 
  updateDraftText, 
  setSetting, 
  getSetting,
  ContactRecord,
  DraftRecord
} from '../db/index.js';
import { WhatsAppSocketManager } from '../whatsapp/socket-manager.js';
import { config } from '../config/index.js';

export interface DisambiguationState {
  targetName: string;
  originalInstruction: string;
  matches: { id?: number; phone_number: string; display_name: string | null }[];
  timestamp: number;
}

export interface ProcessInstructionResult {
  type: 'chat_reply' | 'disambiguation_required' | 'draft_staged' | 'error';
  replyText: string;
  draft?: DraftRecord;
  matches?: ContactRecord[];
}

export class DraftEngine {
  private assistantSocket: WhatsAppSocketManager | null = null;

  constructor(assistantSocket?: WhatsAppSocketManager) {
    if (assistantSocket) {
      this.assistantSocket = assistantSocket;
    }
  }

  public setAssistantSocket(socket: WhatsAppSocketManager) {
    this.assistantSocket = socket;
  }

  /**
   * Main entrypoint for Cephas's instructions from Executive Chat or Voice
   */
  public async processExecutiveInstruction(instruction: string): Promise<ProcessInstructionResult> {
    const trimmed = instruction.trim();

    // 1. Check if there is an active disambiguation session
    const activeDisambig = this.getPendingDisambiguation();
    if (activeDisambig) {
      const selected = this.resolveDisambiguationChoice(trimmed, activeDisambig);
      if (selected) {
        // Clear disambiguation
        this.clearPendingDisambiguation();
        // Generate draft for the selected contact
        return this.generateAndStageDraft(selected, activeDisambig.originalInstruction);
      } else if (trimmed.toLowerCase() === 'cancel' || trimmed.toLowerCase() === 'abort') {
        this.clearPendingDisambiguation();
        return {
          type: 'chat_reply',
          replyText: 'Understood. Cancelled the message draft request.'
        };
      }
    }

    // 1.5 Check if this is a financial expense log (e.g. "Spent 15k on fuel...", "Paid 4500 for lunch...")
    const lower = trimmed.toLowerCase();
    const isExpenseLikely = 
      lower.includes('spent') || 
      lower.includes('expense') || 
      lower.includes('paid ') || 
      lower.includes('bought') || 
      lower.includes('cost');

    if (isExpenseLikely) {
      const { financeTracker } = await import('./finance-tracker.js');
      const parsedExpenses = await financeTracker.parseExpenses(trimmed);
      if (parsedExpenses.length > 0) {
        const logResult = await financeTracker.logExpenses(parsedExpenses);
        return {
          type: 'chat_reply',
          replyText: logResult.summaryText
        };
      }
    }

    // 2. Classify intent via Tier 1 (Flash-Lite: sub-second intent extraction)
    const triagePrompt = `You are a high-speed intent extraction engine for executive instructions.
Analyze the user's message and determine if they want to send/tell/draft a message to a person or client.
Return ONLY valid JSON matching this schema:
{
  "is_message_intent": boolean,
  "target_name": string | null,
  "target_phone": string | null,
  "message_summary": string | null
}

User Message: "${trimmed}"`;

    try {
      const classification = await aiRouter.executeTask('intent_classification', triagePrompt, {
        temperature: 0.1
      });

      // Parse JSON
      interface ParsedIntent {
        is_message_intent: boolean;
        target_name: string | null;
        target_phone: string | null;
        message_summary: string | null;
      }
      let parsed: ParsedIntent = { is_message_intent: false, target_name: null, target_phone: null, message_summary: null };
      try {
        const jsonMatch = classification.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn('Failed to parse intent JSON, falling back to regex:', classification.text);
      }

      // If not a message intent, let standard executive chat handle it
      if (!parsed.is_message_intent || (!parsed.target_name && !parsed.target_phone)) {
        return {
          type: 'chat_reply',
          replyText: '' // Indicates standard executive chat should process
        };
      }

      // 3. Resolve Target Contact(s)
      const targetQuery = (parsed.target_name || parsed.target_phone || '').trim();
      let matches = searchContacts(targetQuery);

      // If target_phone provided directly (e.g. +234...)
      if (parsed.target_phone) {
        const normalized = parsed.target_phone.replace(/\D/g, '');
        const directMatch = matches.find(m => m.phone_number === normalized);
        if (!directMatch) {
          const newContact = upsertContact(normalized, parsed.target_name || 'Contact', 'manual');
          matches = [newContact];
        }
      }

      // Case A: No contact found
      if (matches.length === 0) {
        return {
          type: 'chat_reply',
          replyText: `I couldn't find "${targetQuery}" in our local address book. Please reply with their phone number (e.g., +234...) and I will prepare the draft immediately.`
        };
      }

      // Case B: Exactly 1 contact found -> Stage Draft directly
      if (matches.length === 1) {
        return this.generateAndStageDraft(matches[0], trimmed);
      }

      // Case C: Multiple contacts found -> Trigger Disambiguation
      this.savePendingDisambiguation({
        targetName: targetQuery,
        originalInstruction: trimmed,
        matches: matches.map(m => ({ id: m.id, phone_number: m.phone_number, display_name: m.display_name })),
        timestamp: Date.now()
      });

      let optionsList = matches
        .map((m, idx) => `${idx + 1}. **${m.display_name || 'Unknown'}** (+${m.phone_number})`)
        .join('\n');

      return {
        type: 'disambiguation_required',
        replyText: `I found ${matches.length} contacts matching "${targetQuery}":\n\n${optionsList}\n\nWhich one should I send this to? (Reply 1, 2, etc.)`,
        matches
      };

    } catch (err: any) {
      console.error('Error during intent classification:', err);
      return {
        type: 'error',
        replyText: `An error occurred while analyzing the instruction: ${err.message}`
      };
    }
  }

  /**
   * Generates a polished executive WhatsApp draft via Tier 2 (Executive Flash) and stages in SQLite
   */
  public async generateAndStageDraft(
    contact: ContactRecord | { phone_number: string; display_name: string | null },
    instruction: string
  ): Promise<ProcessInstructionResult> {
    const draftPrompt = `You are Zerubbabel, writing an executive outbound WhatsApp message on behalf of Cephas.
Recipient Name: ${contact.display_name || 'Partner/Client'}
Recipient Phone: +${contact.phone_number}
Cephas's Instruction: "${instruction}"

Write a concise, professional, warm, and articulate WhatsApp message to the recipient communicating this instruction clearly.
Do NOT include greetings like "Dear sir" — write natural modern WhatsApp business communication.
Do NOT include the signature at the bottom (our engine appends the official signature automatically).
Return ONLY the text of the message to be sent.`;

    const generated = await aiRouter.executeTask('draft_generation', draftPrompt, {
      temperature: 0.5
    });

    const draftText = generated.text.trim().replace(/^["']|["']$/g, '');

    // Insert into SQLite draft queue
    const draft = createDraft(
      contact.phone_number,
      contact.display_name,
      draftText,
      instruction
    );

    const confirmationReply = `📝 **Outbound WhatsApp Draft Staged for ${contact.display_name || '+' + contact.phone_number}:**\n\n` +
      `> "${draftText}"\n` +
      `> *— Sent on behalf of Cephas by Zerubbabel (Executive Assistant)*\n\n` +
      `Tap **[Approve & Send]** in the app or confirm to dispatch via WhatsApp Socket 2.`;

    return {
      type: 'draft_staged',
      replyText: confirmationReply,
      draft
    };
  }

  /**
   * Approve and dispatch draft via Socket 2
   */
  public async approveAndDispatch(draftId: number): Promise<{ success: boolean; message: string }> {
    const draft = getDraftById(draftId);
    if (!draft) {
      throw new Error(`Draft ID ${draftId} not found.`);
    }

    if (draft.status !== 'pending_approval') {
      throw new Error(`Draft #${draftId} is already marked as ${draft.status}.`);
    }

    if (!this.assistantSocket) {
      throw new Error('Socket 2 (Assistant SIM) is not attached to DraftEngine.');
    }

    const fullMessage = `${draft.draft_text}\n\n${config.outboundSignature}`;

    // Mark approved in DB
    updateDraftStatus(draftId, 'approved');

    // Dispatch via WhatsApp Socket 2
    await this.assistantSocket.sendMessage(draft.recipient_phone, fullMessage, draftId);

    return {
      success: true,
      message: `✅ Message dispatched to ${draft.recipient_name || '+' + draft.recipient_phone} via WhatsApp Socket 2.`
    };
  }

  /**
   * Cancel / reject draft
   */
  public cancelDraft(draftId: number, reason = 'Cancelled by Cephas'): void {
    updateDraftStatus(draftId, 'rejected', reason);
  }

  /**
   * Edit draft content
   */
  public editDraft(draftId: number, newContent: string): void {
    updateDraftText(draftId, newContent);
  }

  // ---------------------------------------------------------------------------
  // Disambiguation Session Helpers
  // ---------------------------------------------------------------------------
  private savePendingDisambiguation(state: DisambiguationState) {
    setSetting('pending_disambiguation', JSON.stringify(state));
  }

  private getPendingDisambiguation(): DisambiguationState | null {
    const raw = getSetting('pending_disambiguation');
    if (!raw) return null;
    try {
      const parsed: DisambiguationState = JSON.parse(raw);
      // Expire after 10 minutes
      if (Date.now() - parsed.timestamp > 10 * 60 * 1000) {
        this.clearPendingDisambiguation();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private clearPendingDisambiguation() {
    setSetting('pending_disambiguation', '');
  }

  private resolveDisambiguationChoice(
    input: string,
    state: DisambiguationState
  ): { phone_number: string; display_name: string | null } | null {
    const clean = input.trim().toLowerCase();

    // Check numeric choice: "1", "2", "#1", "first"
    const num = parseInt(clean.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= state.matches.length) {
      return state.matches[num - 1];
    }

    // Check name match
    const found = state.matches.find(m => 
      m.display_name && m.display_name.toLowerCase().includes(clean)
    );
    if (found) return found;

    return null;
  }
}

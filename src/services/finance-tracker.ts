import { GoogleAuthManager } from '../google/auth.js';
import { aiRouter } from '../ai/router.js';
import { 
  logExpense, 
  getExpensesForRange, 
  getExpensesForMonth, 
  markExpenseSynced,
  FinanceRecord 
} from '../db/index.js';

export interface ParsedExpenseItem {
  item: string;
  category: string;
  amount: number;
  currency: string;
  notes?: string;
}

export class FinanceTrackerService {
  private spreadsheetId: string | null = null;
  private readonly SPREADSHEET_TITLE = 'Cephas Finance Tracker';

  /**
   * Parse natural language expense report into structured items via Gemini
   */
  public async parseExpenses(input: string): Promise<ParsedExpenseItem[]> {
    const prompt = `You are a precision financial extraction engine for Cephas.
Extract all expenses mentioned in the user's message.
Recognize Nigerian Naira shortcuts (e.g. "15k" = 15000 NGN, "4500" = 4500 NGN) and foreign currencies ($ or USD).
Assign a logical category: Food & Dining, Transport & Fuel, Software & Subscriptions, Family & Personal, Business Operations, Health, or Miscellaneous.

Return ONLY a valid JSON array matching this schema:
[
  {
    "item": "string",
    "category": "string",
    "amount": number,
    "currency": "NGN" | "USD" | "EUR" | "GBP",
    "notes": "string"
  }
]

If no expenses are mentioned, return [].

User message: "${input}"`;

    try {
      const response = await aiRouter.executeTask('intent_classification', prompt, {
        temperature: 0.1
      });

      const match = response.text.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]) as ParsedExpenseItem[];
      }
      return [];
    } catch (err: any) {
      console.error('Failed to parse expenses:', err);
      return [];
    }
  }

  /**
   * Record parsed expenses to SQLite and Google Sheets
   */
  public async logExpenses(items: ParsedExpenseItem[]): Promise<{
    logged: FinanceRecord[];
    summaryText: string;
    sheetSynced: boolean;
  }> {
    if (items.length === 0) {
      return {
        logged: [],
        summaryText: 'No expense items recognized.',
        sheetSynced: false
      };
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g. "October 2026"

    const savedRecords: FinanceRecord[] = [];
    for (const item of items) {
      const record = logExpense(
        dateStr,
        monthYear,
        item.item,
        item.category,
        item.amount,
        item.currency || 'NGN',
        item.notes || null,
        false
      );
      savedRecords.push(record);
    }

    // Attempt to sync to Google Sheets if configured
    let sheetSynced = false;
    try {
      if (GoogleAuthManager.isConfigured()) {
        await this.syncToGoogleSheet(monthYear, savedRecords);
        sheetSynced = true;
      }
    } catch (sheetErr: any) {
      console.warn('⚠️ Could not sync to Google Sheets (local SQLite logged):', sheetErr?.message || sheetErr);
    }

    // Format Confirmation Summary
    let totalNgn = 0;
    let totalUsd = 0;
    const bullets = savedRecords.map(r => {
      if (r.currency === 'USD') totalUsd += r.amount;
      else totalNgn += r.amount;
      const symbol = r.currency === 'USD' ? '$' : '₦';
      return `• **${r.item}**: ${symbol}${r.amount.toLocaleString()} _(${r.category})_`;
    }).join('\n');

    let totalStr = '';
    if (totalNgn > 0) totalStr += `₦${totalNgn.toLocaleString()}`;
    if (totalUsd > 0) totalStr += `${totalStr ? ' + ' : ''}$${totalUsd.toLocaleString()}`;

    const confirmation = `✅ **Logged ${savedRecords.length} Expense Item(s) to ${monthYear}:**\n\n` +
      `${bullets}\n\n` +
      `📊 **Total Added:** ${totalStr}\n` +
      `📁 **Status:** Saved to Local SQLite${sheetSynced ? ' & Google Sheets ("Cephas Finance Tracker")' : ' (Google Sheets pending auth)'}.`;

    return {
      logged: savedRecords,
      summaryText: confirmation,
      sheetSynced
    };
  }

  /**
   * Generate Saturday 10:00 PM Weekly Executive Financial Report
   */
  public async generateWeeklyReport(): Promise<string> {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    const expenses = getExpensesForRange(startDateStr, endDateStr);

    if (expenses.length === 0) {
      return `📊 **Weekly Financial Report (${startDateStr} to ${endDateStr}):**\n\nNo expenses were recorded for this past 7-day period.`;
    }

    let totalNgn = 0;
    let totalUsd = 0;
    const categoryTotals: Record<string, number> = {};

    for (const exp of expenses) {
      if (exp.currency === 'USD') {
        totalUsd += exp.amount;
      } else {
        totalNgn += exp.amount;
      }
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    }

    const prompt = `You are Zerubbabel, Chief of Staff to Cephas.
Synthesize an executive Saturday Night Financial Report based on this 7-day expense data:
Period: ${startDateStr} to ${endDateStr}
Total NGN: ₦${totalNgn.toLocaleString()}
Total USD: $${totalUsd.toLocaleString()}
Category Breakdown: ${JSON.stringify(categoryTotals, null, 2)}
Raw Expenses: ${JSON.stringify(expenses.map(e => ({ date: e.date, item: e.item, amount: e.amount, currency: e.currency, category: e.category })), null, 2)}

Provide:
1. Executive summary of weekly spending.
2. Breakdown by category with percentages.
3. Top single largest expenses.
4. One sharp strategic recommendation for cash flow/cost optimization.
Format in clean WhatsApp markdown with emojis.`;

    const report = await aiRouter.executeTask('executive_chat', prompt, {
      temperature: 0.3
    });

    return report.text.trim();
  }

  /**
   * Sync rows to Google Sheets under tab: "{Month} {Year}"
   */
  private async syncToGoogleSheet(monthYear: string, records: FinanceRecord[]): Promise<void> {
    const sheets = await GoogleAuthManager.getSheetsClient();
    const drive = await GoogleAuthManager.getDriveClient();

    // 1. Locate or create spreadsheet "Cephas Finance Tracker"
    let spreadId = this.spreadsheetId;
    if (!spreadId) {
      const searchRes = await drive.files.list({
        q: `name = '${this.SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id, name)'
      });

      if (searchRes.data.files && searchRes.data.files.length > 0) {
        spreadId = searchRes.data.files[0].id!;
      } else {
        // Create new spreadsheet
        const newSheet = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title: this.SPREADSHEET_TITLE }
          }
        });
        spreadId = newSheet.data.spreadsheetId!;
      }
      this.spreadsheetId = spreadId;
    }

    // 2. Ensure tab exists for monthYear (e.g. "October 2026")
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: spreadId });
    const sheetExists = metadata.data.sheets?.some(s => s.properties?.title === monthYear);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: monthYear }
              }
            }
          ]
        }
      });

      // Insert headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadId,
        range: `'${monthYear}'!A1:F1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Date', 'Item / Purpose', 'Category', 'Amount', 'Currency', 'Notes']]
        }
      });
    }

    // 3. Append rows
    const rows = records.map(r => [
      r.date,
      r.item,
      r.category,
      r.amount,
      r.currency,
      r.notes || ''
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadId,
      range: `'${monthYear}'!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows }
    });

    for (const r of records) {
      if (r.id) markExpenseSynced(r.id);
    }
  }
}

export const financeTracker = new FinanceTrackerService();

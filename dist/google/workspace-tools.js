import { GoogleAuthManager } from './auth.js';
import { upsertContact } from '../db/index.js';
import { config } from '../config/index.js';
export class GoogleWorkspaceTools {
    // ---------------------------------------------------------------------------
    // Google Calendar
    // ---------------------------------------------------------------------------
    static async getTodayAgenda() {
        if (!GoogleAuthManager.isConfigured())
            return [];
        try {
            const calendar = await GoogleAuthManager.getCalendarClient();
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });
            const items = res.data.items || [];
            return items.map(ev => ({
                id: ev.id || undefined,
                summary: ev.summary || 'Untitled Event',
                start: ev.start?.dateTime || ev.start?.date || '',
                end: ev.end?.dateTime || ev.end?.date || '',
                location: ev.location || undefined,
                attendees: ev.attendees?.map(a => a.displayName || a.email || '') || []
            }));
        }
        catch (err) {
            console.warn('⚠️ Google Calendar agenda fetch failed:', err?.message || err);
            return [];
        }
    }
    static async createCalendarEvent(summary, startDateTime, endDateTime, description, attendees) {
        const calendar = await GoogleAuthManager.getCalendarClient();
        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary,
                description,
                start: { dateTime: startDateTime },
                end: { dateTime: endDateTime },
                attendees: attendees ? attendees.map(email => ({ email })) : undefined
            }
        });
        return {
            id: res.data.id || '',
            htmlLink: res.data.htmlLink || ''
        };
    }
    // ---------------------------------------------------------------------------
    // Google Tasks
    // ---------------------------------------------------------------------------
    static async getTopTasks(maxResults = 5) {
        if (!GoogleAuthManager.isConfigured())
            return [];
        try {
            const tasks = await GoogleAuthManager.getTasksClient();
            const res = await tasks.tasks.list({
                tasklist: '@default',
                showCompleted: false,
                maxResults
            });
            const items = res.data.items || [];
            return items.map(t => ({
                id: t.id || undefined,
                title: t.title || 'Untitled Task',
                notes: t.notes || undefined,
                due: t.due || undefined,
                status: t.status || undefined
            }));
        }
        catch (err) {
            console.warn('⚠️ Google Tasks fetch failed:', err?.message || err);
            return [];
        }
    }
    static async createTask(title, notes, due) {
        const tasks = await GoogleAuthManager.getTasksClient();
        const res = await tasks.tasks.insert({
            tasklist: '@default',
            requestBody: {
                title,
                notes,
                due
            }
        });
        return {
            id: res.data.id || '',
            title: res.data.title || title,
            notes: res.data.notes || notes,
            due: res.data.due || due
        };
    }
    static async completeTask(taskId) {
        if (!GoogleAuthManager.isConfigured())
            return false;
        try {
            const tasks = await GoogleAuthManager.getTasksClient();
            await tasks.tasks.patch({
                tasklist: '@default',
                task: taskId,
                requestBody: {
                    status: 'completed'
                }
            });
            return true;
        }
        catch (err) {
            console.warn('⚠️ Google Tasks complete failed:', err?.message || err);
            return false;
        }
    }
    static async deleteTask(taskId) {
        if (!GoogleAuthManager.isConfigured())
            return false;
        try {
            const tasks = await GoogleAuthManager.getTasksClient();
            await tasks.tasks.delete({
                tasklist: '@default',
                task: taskId
            });
            return true;
        }
        catch (err) {
            console.warn('⚠️ Google Tasks delete failed:', err?.message || err);
            return false;
        }
    }
    // ---------------------------------------------------------------------------
    // Gmail API (Past 24 Hours Executive Digest)
    // ---------------------------------------------------------------------------
    static async getRecentImportantEmails(maxResults = 3) {
        if (!GoogleAuthManager.isConfigured())
            return [];
        try {
            const gmail = await GoogleAuthManager.getGmailClient();
            const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
            const res = await gmail.users.messages.list({
                userId: 'me',
                q: `after:${oneDayAgo} is:unread -category:promotions -category:spam`,
                maxResults
            });
            const messages = res.data.messages || [];
            const digests = [];
            for (const m of messages) {
                if (!m.id)
                    continue;
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: m.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date']
                });
                const headers = detail.data.payload?.headers || [];
                const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Unknown Sender';
                const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
                const senderMatch = fromHeader.match(/^"?([^"<]+)"?\s*(?:<.*>)?$/);
                const cleanSender = senderMatch ? senderMatch[1].trim() : fromHeader;
                digests.push({
                    id: m.id,
                    sender: cleanSender,
                    subject: subjectHeader,
                    snippet: detail.data.snippet || ''
                });
            }
            return digests;
        }
        catch (err) {
            console.warn('⚠️ Gmail digest fetch failed:', err?.message || err);
            return [];
        }
    }
    // ---------------------------------------------------------------------------
    // Google Contacts -> Local SQLite Sync
    // ---------------------------------------------------------------------------
    static async syncGoogleContacts() {
        if (!GoogleAuthManager.isConfigured()) {
            return { syncedCount: 0 };
        }
        try {
            const people = await GoogleAuthManager.getPeopleClient();
            const res = await people.people.connections.list({
                resourceName: 'people/me',
                pageSize: 500,
                personFields: 'names,phoneNumbers,organizations'
            });
            const connections = res.data.connections || [];
            let count = 0;
            for (const person of connections) {
                const name = person.names?.[0]?.displayName || null;
                const phone = person.phoneNumbers?.[0]?.value || null;
                const org = person.organizations?.[0]?.name || null;
                if (phone && phone.replace(/\D/g, '').length >= 7) {
                    upsertContact(phone, name, 'google_contacts', org ? `Org: ${org}` : null);
                    count++;
                }
            }
            console.log(`✅ [Google Contacts] Successfully synced ${count} contacts to SQLite.`);
            return { syncedCount: count };
        }
        catch (err) {
            console.error('❌ Failed to sync Google Contacts:', err?.message || err);
            return { syncedCount: 0 };
        }
    }
    // ---------------------------------------------------------------------------
    // Google Docs Creation & Authoring
    // ---------------------------------------------------------------------------
    static async createGoogleDoc(title, bodyText, targetFolderName = config.googleDriveMeetingFolderName) {
        const docs = await GoogleAuthManager.getDocsClient();
        const drive = await GoogleAuthManager.getDriveClient();
        // 1. Create empty document
        const createRes = await docs.documents.create({
            requestBody: { title }
        });
        const docId = createRes.data.documentId;
        // 2. Insert content
        if (bodyText) {
            await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                    requests: [
                        {
                            insertText: {
                                location: { index: 1 },
                                text: bodyText
                            }
                        }
                    ]
                }
            });
        }
        // 3. Move document into target Drive folder
        try {
            // Find or create folder
            let folderId = null;
            const folderSearch = await drive.files.list({
                q: `name = '${targetFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)'
            });
            if (folderSearch.data.files && folderSearch.data.files.length > 0) {
                folderId = folderSearch.data.files[0].id;
            }
            else {
                const newFolder = await drive.files.create({
                    requestBody: {
                        name: targetFolderName,
                        mimeType: 'application/vnd.google-apps.folder'
                    },
                    fields: 'id'
                });
                folderId = newFolder.data.id;
            }
            if (folderId) {
                await drive.files.update({
                    fileId: docId,
                    addParents: folderId,
                    fields: 'id, parents'
                });
            }
        }
        catch (moveErr) {
            console.warn('⚠️ Could not move doc into target folder (doc created in root):', moveErr);
        }
        return {
            docId,
            url: `https://docs.google.com/document/d/${docId}/edit`
        };
    }
}

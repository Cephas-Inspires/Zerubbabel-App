import { GoogleAuthManager } from './auth.js';
import { upsertContact } from '../db/index.js';
import { config } from '../config/index.js';

export interface CalendarEvent {
  id?: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

export interface TaskItem {
  id?: string;
  title: string;
  notes?: string;
  due?: string;
  status?: string;
}

export class GoogleWorkspaceTools {
  // ---------------------------------------------------------------------------
  // Google Calendar
  // ---------------------------------------------------------------------------
  public static async getTodayAgenda(): Promise<CalendarEvent[]> {
    if (!GoogleAuthManager.isConfigured()) return [];
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
    } catch (err: any) {
      console.warn('⚠️ Google Calendar agenda fetch failed:', err?.message || err);
      return [];
    }
  }

  public static async createCalendarEvent(
    summary: string,
    startDateTime: string,
    endDateTime: string,
    description?: string,
    attendees?: string[]
  ): Promise<{ id: string; htmlLink: string }> {
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
  public static async getTopTasks(maxResults = 5): Promise<TaskItem[]> {
    if (!GoogleAuthManager.isConfigured()) return [];
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
    } catch (err: any) {
      console.warn('⚠️ Google Tasks fetch failed:', err?.message || err);
      return [];
    }
  }

  public static async createTask(title: string, notes?: string, due?: string): Promise<TaskItem> {
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

  // ---------------------------------------------------------------------------
  // Google Contacts -> Local SQLite Sync
  // ---------------------------------------------------------------------------
  public static async syncGoogleContacts(): Promise<{ syncedCount: number }> {
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
    } catch (err: any) {
      console.error('❌ Failed to sync Google Contacts:', err?.message || err);
      return { syncedCount: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // Google Docs Creation & Authoring
  // ---------------------------------------------------------------------------
  public static async createGoogleDoc(
    title: string,
    bodyText: string,
    targetFolderName = config.googleDriveMeetingFolderName
  ): Promise<{ docId: string; url: string }> {
    const docs = await GoogleAuthManager.getDocsClient();
    const drive = await GoogleAuthManager.getDriveClient();

    // 1. Create empty document
    const createRes = await docs.documents.create({
      requestBody: { title }
    });
    const docId = createRes.data.documentId!;

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
      let folderId: string | null = null;
      const folderSearch = await drive.files.list({
        q: `name = '${targetFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)'
      });

      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
      } else {
        const newFolder = await drive.files.create({
          requestBody: {
            name: targetFolderName,
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id'
        });
        folderId = newFolder.data.id!;
      }

      if (folderId) {
        await drive.files.update({
          fileId: docId,
          addParents: folderId,
          fields: 'id, parents'
        });
      }
    } catch (moveErr) {
      console.warn('⚠️ Could not move doc into target folder (doc created in root):', moveErr);
    }

    return {
      docId,
      url: `https://docs.google.com/document/d/${docId}/edit`
    };
  }
}

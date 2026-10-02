import fs from 'node:fs';
import { google } from 'googleapis';
import { config } from '../config/index.js';
export class GoogleAuthManager {
    static authClient = null;
    static isConfigured() {
        return fs.existsSync(config.googleCredentialsPath);
    }
    static async getAuthClient() {
        if (this.authClient) {
            return this.authClient;
        }
        if (!this.isConfigured()) {
            throw new Error(`Google credentials file not found at ${config.googleCredentialsPath}. Please follow Google setup instructions.`);
        }
        const raw = fs.readFileSync(config.googleCredentialsPath, 'utf-8');
        const creds = JSON.parse(raw);
        // Support both Service Account and OAuth2 client
        if (creds.type === 'service_account') {
            const auth = new google.auth.GoogleAuth({
                keyFile: config.googleCredentialsPath,
                scopes: [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/documents',
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/tasks',
                    'https://www.googleapis.com/auth/contacts'
                ]
            });
            this.authClient = await auth.getClient();
            return this.authClient;
        }
        else {
            // Installed OAuth2 Client
            const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob');
            if (fs.existsSync(config.googleTokenPath)) {
                const tokenRaw = fs.readFileSync(config.googleTokenPath, 'utf-8');
                oAuth2Client.setCredentials(JSON.parse(tokenRaw));
            }
            this.authClient = oAuth2Client;
            return this.authClient;
        }
    }
    static async getDriveClient() {
        const auth = await this.getAuthClient();
        return google.drive({ version: 'v3', auth });
    }
    static async getDocsClient() {
        const auth = await this.getAuthClient();
        return google.docs({ version: 'v1', auth });
    }
    static async getSheetsClient() {
        const auth = await this.getAuthClient();
        return google.sheets({ version: 'v4', auth });
    }
    static async getCalendarClient() {
        const auth = await this.getAuthClient();
        return google.calendar({ version: 'v3', auth });
    }
    static async getTasksClient() {
        const auth = await this.getAuthClient();
        return google.tasks({ version: 'v1', auth });
    }
    static async getPeopleClient() {
        const auth = await this.getAuthClient();
        return google.people({ version: 'v1', auth });
    }
    static async getGmailClient() {
        const auth = await this.getAuthClient();
        return google.gmail({ version: 'v1', auth });
    }
}

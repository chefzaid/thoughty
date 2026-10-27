import { cloudFetch as fetch } from './cloud-operation';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { providerFailure } from './provider-failure';
import type { CloudProvider, CloudTokens, CloudFileInfo } from './cloud-provider.interface';

const PROVIDER_NAME = 'Google Drive';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'Thoughty';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

@Injectable()
export class GoogleDriveProvider implements CloudProvider {
  private readonly logger = new Logger(GoogleDriveProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_DRIVE_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('GOOGLE_DRIVE_CLIENT_SECRET', '');
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<CloudTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'token exchange', response, 'code_exchange');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<CloudTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'token refresh', response, 'token_refresh');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Google doesn't return a new refresh token
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  private async getOrCreateAppFolder(accessToken: string): Promise<string> {
    // Search for existing folder
    const searchParams = new URLSearchParams({
      q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
    });

    const searchResponse = await fetch(`${GOOGLE_DRIVE_API}/files?${searchParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'app folder search', searchResponse);
    }

    const searchData = await searchResponse.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create the folder
    const createResponse = await fetch(`${GOOGLE_DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createResponse.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'app folder creation', createResponse);
    }

    const folderData = await createResponse.json();
    return folderData.id;
  }

  async listFiles(accessToken: string): Promise<CloudFileInfo[]> {
    const folderId = await this.getOrCreateAppFolder(accessToken);

    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,size,modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'file list', response);
    }

    const data = await response.json();
    return (data.files || []).map((f: Record<string, string>) => ({
      id: f.id,
      name: f.name,
      size: Number.parseInt(f.size || '0', 10),
      modifiedAt: f.modifiedTime,
    }));
  }

  async uploadFile(accessToken: string, filename: string, content: string | Buffer, mimeType: string): Promise<CloudFileInfo> {
    const folderId = await this.getOrCreateAppFolder(accessToken);

    // Check if file already exists to update it
    const searchParams = new URLSearchParams({
      q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    const searchResponse = await fetch(`${GOOGLE_DRIVE_API}/files?${searchParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingFileId: string | null = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    const boundary = 'thoughty_boundary_' + Date.now();
    const metadata = existingFileId
      ? { name: filename }
      : { name: filename, parents: [folderId] };

    const multipartPrefix =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const multipartBody = Buffer.concat([
      Buffer.from(multipartPrefix),
      Buffer.isBuffer(content) ? content : Buffer.from(content),
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const url = existingFileId
      ? `${GOOGLE_UPLOAD_API}/files/${existingFileId}?uploadType=multipart&fields=id,name,size,modifiedTime`
      : `${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,modifiedTime`;

    const method = existingFileId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'upload', response);
    }

    const fileData = await response.json();
    return {
      id: fileData.id,
      name: fileData.name,
      size: Number.parseInt(fileData.size || '0', 10),
      modifiedAt: fileData.modifiedTime,
    };
  }

  async downloadFile(accessToken: string, fileId: string): Promise<string> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'download', response);
    }

    return response.text();
  }
}

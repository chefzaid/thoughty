import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CloudProvider, CloudTokens, CloudFileInfo } from './cloud-provider.interface';

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2';
const APP_FOLDER_PATH = '/Thoughty';

@Injectable()
export class DropboxProvider implements CloudProvider {
  private readonly logger = new Logger(DropboxProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('DROPBOX_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('DROPBOX_CLIENT_SECRET', '');
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      state,
    });
    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<CloudTokens> {
    const response = await fetch(DROPBOX_TOKEN_URL, {
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
      const error = await response.text();
      this.logger.error(`Dropbox token exchange failed: ${error}`);
      throw new Error('Failed to exchange authorization code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 14400) * 1000,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<CloudTokens> {
    const response = await fetch(DROPBOX_TOKEN_URL, {
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
      const error = await response.text();
      this.logger.error(`Dropbox token refresh failed: ${error}`);
      throw new Error('Failed to refresh access token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Dropbox keeps original refresh token
      expiresAt: Date.now() + (data.expires_in || 14400) * 1000,
    };
  }

  private async ensureAppFolder(accessToken: string): Promise<void> {
    const response = await fetch(`${DROPBOX_API}/files/get_metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: APP_FOLDER_PATH }),
    });

    if (response.ok) return;

    // Folder doesn't exist, create it
    const createResponse = await fetch(`${DROPBOX_API}/files/create_folder_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: APP_FOLDER_PATH, autorename: false }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      // Ignore conflict errors (folder already exists)
      if (!error.includes('conflict')) {
        this.logger.error(`Dropbox folder creation failed: ${error}`);
        throw new Error('Failed to create app folder');
      }
    }
  }

  async listFiles(accessToken: string): Promise<CloudFileInfo[]> {
    await this.ensureAppFolder(accessToken);

    const response = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: APP_FOLDER_PATH,
        recursive: false,
        include_deleted: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to list files');
    }

    const data = await response.json();
    return (data.entries || [])
      .filter((f: Record<string, string>) => f['.tag'] === 'file')
      .map((f: Record<string, string | number>) => ({
        id: f.id as string,
        name: f.name as string,
        size: Number(f.size || 0),
        modifiedAt: f.server_modified as string,
      }));
  }

  async uploadFile(accessToken: string, filename: string, content: string, _mimeType: string): Promise<CloudFileInfo> {
    await this.ensureAppFolder(accessToken);
    const filePath = `${APP_FOLDER_PATH}/${filename}`;

    const response = await fetch(`${DROPBOX_CONTENT_API}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: filePath,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: content,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Dropbox upload failed: ${error}`);
      throw new Error('Failed to upload file');
    }

    const fileData = await response.json();
    return {
      id: fileData.id,
      name: fileData.name,
      size: fileData.size || 0,
      modifiedAt: fileData.server_modified,
    };
  }

  async downloadFile(accessToken: string, fileId: string): Promise<string> {
    // Dropbox download requires path, but we receive the id
    // Use the id directly with the download endpoint
    const response = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    return response.text();
  }
}

import { cloudFetch as fetch } from './cloud-operation';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { providerFailure } from './provider-failure';
import type { CloudProvider, CloudTokens, CloudFileInfo } from './cloud-provider.interface';

const PROVIDER_NAME = 'OneDrive';
const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const APP_FOLDER_NAME = 'Thoughty';
const SCOPES = 'Files.ReadWrite offline_access';

@Injectable()
export class OneDriveProvider implements CloudProvider {
  private readonly logger = new Logger(OneDriveProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('ONEDRIVE_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('ONEDRIVE_CLIENT_SECRET', '');
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
      state,
    });
    return `${MS_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<CloudTokens> {
    const response = await fetch(MS_TOKEN_URL, {
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
    const response = await fetch(MS_TOKEN_URL, {
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
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  private async getOrCreateAppFolder(accessToken: string): Promise<string> {
    // Check if folder exists under root
    const searchResponse = await fetch(
      `${GRAPH_API}/me/drive/root:/${APP_FOLDER_NAME}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      return data.id;
    }

    // Create the folder
    const createResponse = await fetch(`${GRAPH_API}/me/drive/root/children`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
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

    const response = await fetch(
      `${GRAPH_API}/me/drive/items/${folderId}/children?$select=id,name,size,lastModifiedDateTime&$orderby=lastModifiedDateTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'file list', response);
    }

    const data = await response.json();
    return (data.value || []).map((f: Record<string, string | number>) => ({
      id: f.id as string,
      name: f.name as string,
      size: Number(f.size || 0),
      modifiedAt: f.lastModifiedDateTime as string,
    }));
  }

  async uploadFile(accessToken: string, filename: string, content: string | Buffer, mimeType: string): Promise<CloudFileInfo> {
    const folderId = await this.getOrCreateAppFolder(accessToken);
    const requestBody = typeof content === 'string' ? content : Uint8Array.from(content).buffer;

    // Upload (creates or replaces)
    const response = await fetch(
      `${GRAPH_API}/me/drive/items/${folderId}:/${encodeURIComponent(filename)}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mimeType,
        },
        body: requestBody,
      },
    );

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'upload', response);
    }

    const fileData = await response.json();
    return {
      id: fileData.id,
      name: fileData.name,
      size: fileData.size || 0,
      modifiedAt: fileData.lastModifiedDateTime,
    };
  }

  async downloadFile(accessToken: string, fileId: string): Promise<string> {
    const response = await fetch(
      `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/content`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: 'follow',
      },
    );

    if (!response.ok) {
      throw await providerFailure(this.logger, PROVIDER_NAME, 'download', response);
    }

    return response.text();
  }
}

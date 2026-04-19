export interface CloudFileInfo {
  id: string;
  name: string;
  size: number;
  modifiedAt: string;
}

export interface CloudTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

export interface CloudProvider {
  /**
   * Exchange an authorization code for tokens
   */
  exchangeCode(code: string, redirectUri: string): Promise<CloudTokens>;

  /**
   * Refresh an expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<CloudTokens>;

  /**
   * List files in the Thoughty app folder
   */
  listFiles(accessToken: string): Promise<CloudFileInfo[]>;

  /**
   * Upload a file to the Thoughty app folder
   */
  uploadFile(accessToken: string, filename: string, content: string, mimeType: string): Promise<CloudFileInfo>;

  /**
   * Download a file by its ID
   */
  downloadFile(accessToken: string, fileId: string): Promise<string>;

  /**
   * Get the OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string;
}

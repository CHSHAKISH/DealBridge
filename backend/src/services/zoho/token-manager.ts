import axios from 'axios';
import { config } from '../../config/index.js';

class ZohoTokenManager {
  private accessToken: string | null = null;
  private tokenExpiryTime: number = 0; // timestamp in ms
  private refreshPromise: Promise<string> | null = null;

  private getAccountsUrl(): string {
    const domainMap: Record<string, string> = {
      com: 'https://accounts.zoho.com',
      ae: 'https://accounts.zoho.ae',
      in: 'https://accounts.zoho.in',
      eu: 'https://accounts.zoho.eu',
      com_au: 'https://accounts.zoho.com.au',
    };
    return domainMap[config.zoho.region] || 'https://accounts.zoho.in';
  }

  /**
   * Returns a valid access token. If expired or nearing expiry (< 2 minutes),
   * refreshes it automatically with concurrency locking (mutex).
   */
  async getValidToken(): Promise<string> {
    const now = Date.now();
    const safetyBufferMs = 2 * 60 * 1000; // 2 minutes buffer

    // If token exists and is valid, return immediately
    if (this.accessToken && this.tokenExpiryTime - now > safetyBufferMs) {
      return this.accessToken;
    }

    // If another worker is already refreshing the token, await that same promise (Mutex)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Otherwise, initiate refresh and hold the lock
    this.refreshPromise = this.refreshToken();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refreshToken(): Promise<string> {
    const accountsUrl = this.getAccountsUrl();
    const tokenUrl = `${accountsUrl}/oauth/v2/token`;

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.zoho.clientId,
        client_secret: config.zoho.clientSecret,
        refresh_token: config.zoho.refreshToken,
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      const data = response.data;
      if (data.error) {
        throw new Error(`Zoho OAuth Refresh Failed: ${data.error}`);
      }

      this.accessToken = data.access_token;
      // Expires in seconds (typically 3600s = 1 hour)
      const expiresInMs = (data.expires_in || 3600) * 1000;
      this.tokenExpiryTime = Date.now() + expiresInMs;

      return this.accessToken as string;
    } catch (error: any) {
      this.accessToken = null;
      this.tokenExpiryTime = 0;
      throw new Error(`Failed to refresh Zoho Access Token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Force invalidates the current token (used if Zoho returns 401 Unauthorized)
   */
  invalidateToken() {
    this.accessToken = null;
    this.tokenExpiryTime = 0;
  }
}

export const zohoTokenManager = new ZohoTokenManager();
export default zohoTokenManager;

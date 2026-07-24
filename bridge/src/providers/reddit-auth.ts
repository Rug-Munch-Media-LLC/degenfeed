/**
 * Reddit OAuth2 authentication for script apps.
 *
 * Reddit blocks unauthenticated traffic aggressively (429s, CDN bans).
 * With a registered OAuth2 "script" app you get:
 *   - 600 requests per 10 minutes (vs 60 unauthenticated)
 *   - Access to oauth.reddit.com endpoints (more reliable)
 *   - No CDN rate-limit blocking
 *
 * Setup:
 *   1. Go to https://www.reddit.com/prefs/apps → "Create App" → "script"
 *   2. Name: "DegenFeed", Redirect URI: http://localhost:8080
 *   3. Set env vars:
 *      REDDIT_CLIENT_ID=<the string under the app name>
 *      REDDIT_CLIENT_SECRET=<the secret>
 *      REDDIT_USERNAME=<your Reddit username>
 *      REDDIT_PASSWORD=<your Reddit password>
 *
 * Usage:
 *   const auth = new RedditOAuth(env);
 *   const token = await auth.getAccessToken();
 *   // Use token.access_token in Authorization header
 *
 * The token is cached and auto-refreshed when expired.
 */

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_OAUTH_API = 'https://oauth.reddit.com';

export interface RedditToken {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  scope: string;
  /** When this token expires (epoch ms) */
  expires_at: number;
}

export interface RedditAuthConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export class RedditOAuth {
  private config: RedditAuthConfig | null = null;
  private token: RedditToken | null = null;
  private tokenPromise: Promise<RedditToken> | null = null;

  /**
   * Returns the oauth.reddit.com base URL.
   * All authenticated requests should use this instead of www.reddit.com.
   */
  get apiBase(): string {
    return REDDIT_OAUTH_API;
  }

  /** Whether OAuth credentials have been configured */
  get isConfigured(): boolean {
    return (
      this.config !== null &&
      this.config.clientId.length > 0 &&
      this.config.clientSecret.length > 0 &&
      this.config.username.length > 0 &&
      this.config.password.length > 0
    );
  }

  /** Whether we have a valid (non-expired) token cached */
  get hasValidToken(): boolean {
    if (!this.token) return false;
    // Add 60s buffer to avoid edge cases
    return Date.now() < this.token.expires_at - 60_000;
  }

  /**
   * Configure with credentials from env.
   * Safe to call multiple times — only sets if all vars are present.
   */
  configure(config: RedditAuthConfig): void {
    this.config = config;
    // Invalidate cached token on reconfiguration
    this.token = null;
    this.tokenPromise = null;
  }

  /**
   * Configure from process.env.
   * Returns true if all required vars were present.
   */
  configureFromEnv(): boolean {
    const clientId = process.env.REDDIT_CLIENT_ID || '';
    const clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    const username = process.env.REDDIT_USERNAME || '';
    const password = process.env.REDDIT_PASSWORD || '';

    if (!clientId || !clientSecret || !username || !password) {
      console.log('[reddit-auth] OAuth not configured — missing env vars');
      return false;
    }

    this.configure({ clientId, clientSecret, username, password });
    return true;
  }

  /**
   * Get a valid access token.
   * Returns cached token if still valid, otherwise fetches a new one.
   * If credentials aren't configured, returns null.
   */
  async getAccessToken(): Promise<RedditToken | null> {
    if (!this.isConfigured) return null;

    if (this.hasValidToken && this.token) {
      return this.token;
    }

    // Deduplicate concurrent token requests
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = this.fetchToken();
    try {
      this.token = await this.tokenPromise;
      return this.token;
    } finally {
      this.tokenPromise = null;
    }
  }

  /**
   * Fetch a new access token from Reddit using the password grant.
   * https://github.com/reddit-archive/reddit/wiki/OAuth2#token-retrieval
   */
  private async fetchToken(): Promise<RedditToken> {
    if (!this.config) {
      throw new Error('[reddit-auth] Cannot fetch token: not configured');
    }

    console.log('[reddit-auth] Fetching new access token...');

    const body = new URLSearchParams({
      grant_type: 'password',
      username: this.config.username,
      password: this.config.password,
    });

    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64',
    );

    const res = await fetch(REDDIT_AUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'web:DegenFeed-Bridge:v0.2.0 (by /u/degenfeed)',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[reddit-auth] Token fetch failed: ${res.status} ${text}`);
      throw new Error(`Reddit OAuth token fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };

    if (!data.access_token) {
      throw new Error(`Reddit OAuth error: ${data.error || 'unknown'}`);
    }

    const token: RedditToken = {
      access_token: data.access_token,
      token_type: 'bearer',
      expires_in: data.expires_in || 3600,
      scope: data.scope || '*',
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };

    console.log('[reddit-auth] Token obtained, expires in', token.expires_in, 'seconds');
    return token;
  }

  /**
   * Build headers with Authorization Bearer token for authenticated requests.
   * If OAuth isn't configured, returns basic headers for unauthenticated requests.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      'User-Agent': 'web:DegenFeed-Bridge:v0.2.0 (by /u/degenfeed)',
      Accept: 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token.access_token}`;
    }

    return headers;
  }

  /**
   * Fetch from the OAuthed Reddit API.
   * Uses oauth.reddit.com when authenticated, falls back to www.reddit.com.
   *
   * @returns Response object or null if network error
   */
  async apiFetch(path: string, options: { timeout?: number } = {}): Promise<Response | null> {
    const headers = await this.getAuthHeaders();
    const baseUrl = this.isConfigured ? REDDIT_OAUTH_API : 'https://www.reddit.com';
    const url = `${baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(options.timeout ?? 8_000),
      });

      if (res.status === 401) {
        // Token expired, clear and retry once
        console.log('[reddit-auth] Token expired (401), clearing and retrying...');
        this.token = null;
        const newHeaders = await this.getAuthHeaders();
        if (newHeaders.Authorization) {
          const retryRes = await fetch(url, {
            headers: newHeaders,
            signal: AbortSignal.timeout(options.timeout ?? 8_000),
          });
          return retryRes;
        }
      }

      return res;
    } catch (err) {
      console.error(`[reddit-auth] API fetch failed: ${(err as Error).message}`);
      return null;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

let _instance: RedditOAuth | null = null;

/**
 * Get or create the singleton RedditOAuth instance.
 * Configures from env on first call.
 */
export function getRedditOAuth(): RedditOAuth {
  if (!_instance) {
    _instance = new RedditOAuth();
    _instance.configureFromEnv();
  }
  return _instance;
}

/**
 * Reset the singleton (useful for testing / reconfiguration).
 */
export function resetRedditOAuth(): void {
  _instance = null;
}

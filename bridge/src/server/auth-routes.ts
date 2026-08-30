/**
 * @degenfeed/bridge — Auth Routes (OAuth + Email + Session)
 *
 * Replaces the catch-all stub for `/api/auth/*` that previously returned
 * fake `{authenticated:false,user:null}` / `{ok:true}` responses. The
 * production request path is:
 *
 *   Browser → nginx → Next.js → api-server (:3101) → bridge (:8787)
 *
 * The Cloudflare Worker that used to serve these handlers is retired, so
 * the bridge is the ONLY place OAuth/email auth can actually run.
 *
 * Handlers:
 *   GET  /api/auth/{provider}/authorize          → { authorizeUrl, state }
 *   POST /api/auth/{provider}/callback           → { accessToken, profile }
 *   POST /api/auth/email/register                → { success, message, requiresVerification }
 *   POST /api/auth/email/signin                  → { success, user }
 *   GET  /api/auth/email/verify?token=           → { success }
 *   POST /api/auth/email/reset-request           → { success, message }
 *   POST /api/auth/email/reset-confirm           → { success, message }
 *   GET  /api/auth/email/status?email=           → { hasAccount, isVerified }
 *   GET  /api/auth/session                       → { authenticated, user } (cookie)
 *   POST /api/auth/logout                        → clears session cookie
 *
 * Storage notes:
 *   - OAuth state nonces are held in an in-memory Map with TTL (the bridge
 *     is a single long-lived process; a restart invalidates in-flight flows
 *     which is acceptable for a 10-minute nonce).
 *   - Email users are persisted to a JSON file under BRIDGE_DATA_DIR (or
 *     the bridge working directory) so accounts survive restarts. Password
 *     hashes use scrypt with per-user salt (Node crypto).
 *   - Sessions are HMAC-SHA256 signed cookies (AUTH_SECRET, falls back to a
 *     per-process random key with a console warning).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

// ─── Response helpers ──────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, code: string, message: string): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { code, message, status } }));
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk;
      if (data.length > 64 * 1024) {
        req.destroy(new Error('Body too large'));
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
    setTimeout(() => reject(new Error('Request timeout')), 15_000);
  });
}

function getClientIp(req: http.IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') {
    const first = fwd.split(',')[0];
    if (first) return first.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// ─── Rate limiting (in-memory, per-IP) ────────────────────────────────

interface RateWindow {
  timestamps: number[];
}

const rateWindows = new Map<string, RateWindow>();

function checkRateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now();
  let w = rateWindows.get(key);
  if (!w) {
    w = { timestamps: [] };
    rateWindows.set(key, w);
  }
  const cutoff = now - windowMs;
  w.timestamps = w.timestamps.filter((t) => t > cutoff);
  if (w.timestamps.length >= maxReqs) return false;
  w.timestamps.push(now);
  return true;
}

// ─── OAuth state store (in-memory, TTL 10 min) ────────────────────────

interface OAuthState {
  exp: number;
}

const oauthStates = new Map<string, OAuthState>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function generateOAuthState(): string {
  return crypto.randomBytes(16).toString('hex');
}

function storeState(state: string): void {
  oauthStates.set(state, { exp: Date.now() + OAUTH_STATE_TTL_MS });
}

function consumeState(state: string): boolean {
  const entry = oauthStates.get(state);
  if (!entry) return false;
  oauthStates.delete(state);
  return entry.exp > Date.now();
}

// Periodic cleanup of expired states
setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of oauthStates) {
      if (v.exp < now) oauthStates.delete(k);
    }
  },
  5 * 60 * 1000,
).unref();

// ─── Email user store (file-backed JSON) ───────────────────────────────

interface EmailUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string; // scrypt: salt:hash
  emailVerified: boolean;
  verifyToken?: string;
  verifyExp?: number;
  resetToken?: string;
  resetExp?: number;
  createdAt: number;
}

let emailUsers: Record<string, EmailUser> | null = null;

function emailStorePath(): string {
  const dir = process.env.BRIDGE_DATA_DIR || process.cwd();
  return path.join(dir, 'auth-email-users.json');
}

function loadEmailUsers(): Record<string, EmailUser> {
  if (emailUsers) return emailUsers;
  try {
    const raw = fs.readFileSync(emailStorePath(), 'utf8');
    emailUsers = JSON.parse(raw) as Record<string, EmailUser>;
  } catch {
    emailUsers = {};
  }
  return emailUsers;
}

function saveEmailUsers(): void {
  if (!emailUsers) return;
  try {
    fs.writeFileSync(emailStorePath(), JSON.stringify(emailUsers, null, 2), 'utf8');
  } catch (err) {
    console.error(
      '[auth] Failed to persist email users:',
      err instanceof Error ? err.message : err,
    );
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

// ─── Password hashing (scrypt, Node crypto) ───────────────────────────

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

// ─── Session cookie (HMAC-SHA256 signed, __Host-dfid) ─────────────────

const COOKIE_NAME = '__Host-dfid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionPayload {
  sub: string;
  provider: string;
  email?: string;
  displayName?: string;
  exp: number;
  nonce: string;
}

let sessionSecret: string | null = null;

function getSessionSecret(): string {
  if (sessionSecret) return sessionSecret;
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 16) {
    sessionSecret = configured;
    return sessionSecret;
  }
  console.warn(
    '[auth] AUTH_SECRET not set (or too short) — sessions use a per-process random key; ' +
      'users will be logged out on bridge restart.',
  );
  sessionSecret = crypto.randomBytes(32).toString('hex');
  return sessionSecret;
}

function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifySessionCookie(value: string): SessionPayload | null {
  const [data, signature] = value.split('.');
  if (!data || !signature) return null;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

function sessionSetCookie(payload: SessionPayload): string {
  const value = signSession(payload);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function createSession(
  sub: string,
  provider: string,
  opts: { email?: string; displayName?: string } = {},
): { setCookie: string; payload: SessionPayload } {
  const payload: SessionPayload = {
    sub,
    provider,
    email: opts.email,
    displayName: opts.displayName,
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  return { setCookie: sessionSetCookie(payload), payload };
}

// ─── OAuth provider config ─────────────────────────────────────────────

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  profileUrl?: string;
  profilePath?: string; // JSON path to profile object in /users/me response
  extra?: Record<string, string>;
}

function getProvider(name: string): ProviderConfig | null {
  switch (name) {
    case 'google':
      return {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: 'openid email profile',
        profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      };
    case 'github':
      return {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scopes: 'read:user user:email',
        profileUrl: 'https://api.github.com/user',
      };
    case 'discord':
      return {
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        scopes: 'identify email',
        profileUrl: 'https://discord.com/api/users/@me',
      };
    case 'twitter':
      return {
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        scopes: 'tweet.read users.read',
        profileUrl: 'https://api.twitter.com/2/users/me',
        profilePath: 'data',
      };
    case 'reddit':
      return {
        authUrl: 'https://www.reddit.com/api/v1/authorize',
        tokenUrl: 'https://www.reddit.com/api/v1/access_token',
        scopes: 'identity read',
        profileUrl: 'https://oauth.reddit.com/api/v1/me',
      };
    case 'gotosocial':
      return {
        authUrl: `${process.env.GTS_BASE_URL || 'https://social.degenfeed.xyz'}/oauth/authorize`,
        tokenUrl: `${process.env.GTS_BASE_URL || 'https://social.degenfeed.xyz'}/oauth/token`,
        scopes: 'read write follow push',
        profileUrl: `${process.env.GTS_BASE_URL || 'https://social.degenfeed.xyz'}/api/v1/accounts/verify_credentials`,
      };
    default:
      return null;
  }
}

function getClientCredentials(provider: string): { clientId: string; clientSecret?: string } {
  const env = process.env as Record<string, string | undefined>;
  const upper = provider.toUpperCase();
  return {
    clientId: env[`${upper}_CLIENT_ID`] || '',
    clientSecret: env[`${upper}_CLIENT_SECRET`] || '',
  };
}

function getCallbackPath(provider: string): string {
  return `/auth/callback/${provider}`;
}

// ─── OAuth authorize handler ───────────────────────────────────────────

async function handleAuthorize(
  provider: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`oauth:${provider}-authorize:${ip}`, 10, 60_000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many authorize requests. Try again shortly.');
  }

  const cfg = getProvider(provider);
  if (!cfg) return jsonError(res, 404, 'UNKNOWN_PROVIDER', `Unknown OAuth provider: ${provider}`);

  const creds = getClientCredentials(provider);
  if (!creds.clientId) {
    return jsonError(
      res,
      501,
      'NOT_CONFIGURED',
      `${provider} auth not configured (${provider.toUpperCase()}_CLIENT_ID)`,
    );
  }

  const state = generateOAuthState();
  storeState(state);

  const host = req.headers.host || 'app.degenfeed.xyz';
  const redirectUri = `https://${host}${getCallbackPath(provider)}`;

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scopes,
    state,
  });

  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  if (provider === 'reddit') {
    params.set('duration', 'permanent');
  }

  let authorizeUrl: string;
  if (provider === 'gotosocial') {
    authorizeUrl = `${cfg.authUrl}?${params.toString()}`;
  } else {
    authorizeUrl = `${cfg.authUrl}?${params.toString()}`;
  }

  return jsonOk(res, { authorizeUrl, state });
}

// ─── OAuth callback handler ────────────────────────────────────────────

async function handleCallback(
  provider: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`oauth:${provider}-callback:${ip}`, 10, 60_000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many callback attempts. Try again shortly.');
  }

  const cfg = getProvider(provider);
  if (!cfg) return jsonError(res, 404, 'UNKNOWN_PROVIDER', `Unknown OAuth provider: ${provider}`);

  const creds = getClientCredentials(provider);
  if (!creds.clientId) {
    return jsonError(
      res,
      501,
      'NOT_CONFIGURED',
      `${provider} auth not configured (${provider.toUpperCase()}_CLIENT_ID)`,
    );
  }

  let body: { code?: string; state?: string };
  try {
    body = (await readBody(req)) as { code?: string; state?: string };
  } catch {
    return jsonError(res, 400, 'INVALID_BODY', 'Invalid JSON body');
  }

  if (!body.code) return jsonError(res, 400, 'MISSING_CODE', 'Missing authorization code');
  if (!body.state) return jsonError(res, 400, 'MISSING_STATE', 'Missing state nonce');

  if (!consumeState(body.state)) {
    return jsonError(res, 400, 'INVALID_STATE', 'Invalid or expired state nonce');
  }

  const host = req.headers.host || 'app.degenfeed.xyz';
  const redirectUri = `https://${host}${getCallbackPath(provider)}`;

  try {
    let tokenRes: Response;
    const tokenParams = new URLSearchParams({
      client_id: creds.clientId,
      code: body.code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    if (creds.clientSecret) tokenParams.set('client_secret', creds.clientSecret);

    if (provider === 'github') {
      tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code: body.code,
        }),
      });
    } else if (provider === 'reddit') {
      const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
      tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'degenfeed/1.0',
        },
        body: tokenParams.toString(),
      });
    } else if (provider === 'twitter') {
      const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
      tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams.toString(),
      });
    } else {
      tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });
    }

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return jsonError(
        res,
        400,
        'TOKEN_EXCHANGE_FAILED',
        `${provider} token exchange failed: ${errText.slice(0, 200)}`,
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tokenData.access_token) {
      return jsonError(res, 400, 'NO_TOKEN', 'No access token returned');
    }

    // ── Fetch provider profile ──
    let profile: {
      id?: string;
      email?: string;
      username?: string;
      displayName?: string;
      avatar?: string;
    } = {};
    if (cfg.profileUrl) {
      try {
        const profileRes = await fetch(cfg.profileUrl, {
          headers: {
            authorization: `Bearer ${tokenData.access_token}`,
            'user-agent': 'degenfeed/1.0',
          },
        });
        if (profileRes.ok) {
          const raw = (await profileRes.json()) as Record<string, unknown>;
          const data = cfg.profilePath ? (raw[cfg.profilePath] as Record<string, unknown>) : raw;
          profile = normalizeProfile(provider, data);
        }
      } catch {
        /* continue without profile */
      }
    }

    const sub = profile.id || `${provider}:${crypto.randomBytes(8).toString('hex')}`;
    const { setCookie } = createSession(sub, provider, {
      email: profile.email,
      displayName: profile.displayName,
    });

    res.setHeader('set-cookie', setCookie);
    return jsonOk(res, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      profile: { ...profile, provider },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonError(res, 500, 'CALLBACK_FAILED', `OAuth callback failed: ${msg}`);
  }
}

function normalizeProfile(
  provider: string,
  data: Record<string, unknown>,
): { id?: string; email?: string; username?: string; displayName?: string; avatar?: string } {
  switch (provider) {
    case 'google':
      return {
        id: String(data.id ?? ''),
        email: String(data.email ?? ''),
        displayName: String(data.name ?? ''),
        avatar: String(data.picture ?? ''),
      };
    case 'github':
      return {
        id: String(data.id ?? ''),
        email: String(data.email ?? ''),
        username: String(data.login ?? ''),
        displayName: String(data.name ?? ''),
        avatar: String(data.avatar_url ?? ''),
      };
    case 'discord': {
      const id = String(data.id ?? '');
      const avatarHash = String(data.avatar ?? '');
      return {
        id,
        email: String(data.email ?? ''),
        username: String(data.username ?? ''),
        displayName: String(data.username ?? ''),
        avatar:
          id && avatarHash ? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png` : '',
      };
    }
    case 'twitter':
      return {
        id: String(data.id ?? ''),
        username: String(data.username ?? ''),
        displayName: String(data.name ?? ''),
        avatar: String(data.profile_image_url ?? ''),
      };
    case 'reddit':
      return {
        id: String(data.id ?? ''),
        username: String(data.name ?? ''),
        avatar: String(data.icon_img ?? ''),
      };
    case 'gotosocial':
      return {
        id: String(data.id ?? ''),
        username: String(data.username ?? ''),
        displayName: String(data.display_name ?? ''),
        avatar: String(data.avatar ?? ''),
      };
    default:
      return {
        id: String(data.id ?? ''),
        email: String(data.email ?? ''),
        username: String(data.username ?? ''),
        displayName: String(data.display_name ?? data.name ?? ''),
        avatar: String(data.avatar ?? data.picture ?? ''),
      };
  }
}

// ─── Email auth handlers ───────────────────────────────────────────────

async function handleEmailRegister(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`email:register:${ip}`, 5, 60_000)) {
    return jsonError(
      res,
      429,
      'RATE_LIMITED',
      'Too many registration attempts. Try again shortly.',
    );
  }

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = (await readBody(req)) as { email?: string; password?: string; displayName?: string };
  } catch {
    return jsonError(res, 400, 'INVALID_BODY', 'Invalid JSON body');
  }

  if (!body.email || !body.password) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Please enter a valid email address');
  }
  if (body.password.length < 8) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Password must be at least 8 characters long');
  }
  if (body.password.length > 128) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Password must be less than 128 characters');
  }

  const users = loadEmailUsers();
  if (users[email]) {
    return jsonError(res, 409, 'EMAIL_EXISTS', 'This email is already registered. Please sign in.');
  }

  const user: EmailUser = {
    id: crypto.randomUUID(),
    email,
    displayName: body.displayName || email.split('@')[0] || 'user',
    passwordHash: hashPassword(body.password),
    emailVerified: false,
    createdAt: Date.now(),
  };

  // If no mail provider is configured, auto-verify so the account is usable.
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    user.emailVerified = true;
  } else {
    user.verifyToken = crypto.randomUUID();
    user.verifyExp = Date.now() + 24 * 60 * 60 * 1000;
    const verifyUrl = `https://${req.headers.host || 'app.degenfeed.xyz'}/api/auth/email/verify?token=${user.verifyToken}`;
    try {
      await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-postmark-server-token': process.env.POSTMARK_SERVER_TOKEN,
        },
        body: JSON.stringify({
          From: 'noreply@degenfeed.xyz',
          To: email,
          Subject: 'Verify your DegenFeed account',
          HtmlBody: `<p>Welcome to DegenFeed!</p><p><a href="${verifyUrl}">Verify your email</a></p>`,
          MessageStream: 'outbound',
        }),
      });
    } catch {
      // email delivery failure is non-fatal; user can still sign in after verify link
    }
  }

  users[email] = user;
  saveEmailUsers();

  return jsonOk(res, {
    success: true,
    message: user.emailVerified
      ? 'Account created. You can now sign in.'
      : 'Account created. Please check your email to verify your account.',
    requiresVerification: !user.emailVerified,
  });
}

async function handleEmailSignIn(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`email:signin:${ip}`, 5, 60_000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again shortly.');
  }

  let body: { email?: string; password?: string };
  try {
    body = (await readBody(req)) as { email?: string; password?: string };
  } catch {
    return jsonError(res, 400, 'INVALID_BODY', 'Invalid JSON body');
  }

  if (!body.email || !body.password) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return jsonError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const users = loadEmailUsers();
  const user = users[email];
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return jsonError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.emailVerified) {
    return jsonError(res, 403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before signing in.');
  }

  const { setCookie } = createSession(user.id, 'email', {
    email: user.email,
    displayName: user.displayName,
  });
  res.setHeader('set-cookie', setCookie);

  return jsonOk(res, {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    },
  });
}

async function handleEmailVerify(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');
  if (!token) return jsonError(res, 400, 'MISSING_TOKEN', 'Missing verification token');

  const users = loadEmailUsers();
  for (const user of Object.values(users)) {
    if (user.verifyToken === token) {
      if (user.verifyExp && user.verifyExp < Date.now()) {
        return jsonError(
          res,
          400,
          'EXPIRED_TOKEN',
          'Invalid or expired verification token. Please request a new one.',
        );
      }
      user.emailVerified = true;
      user.verifyToken = undefined;
      user.verifyExp = undefined;
      saveEmailUsers();
      return jsonOk(res, {
        success: true,
        message: 'Email verified successfully! You can now sign in.',
      });
    }
  }
  return jsonError(
    res,
    400,
    'INVALID_TOKEN',
    'Invalid or expired verification token. Please request a new one.',
  );
}

async function handlePasswordResetRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`email:pw-reset:${ip}`, 3, 300_000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many reset requests. Try again shortly.');
  }

  let body: { email?: string };
  try {
    body = (await readBody(req)) as { email?: string };
  } catch {
    return jsonError(res, 400, 'INVALID_BODY', 'Invalid JSON body');
  }
  if (!body.email) return jsonError(res, 400, 'VALIDATION_ERROR', 'Email is required');

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    // Don't reveal if email exists — still return success
    return jsonOk(res, {
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });
  }

  const users = loadEmailUsers();
  const user = users[email];
  if (!user) {
    return jsonOk(res, {
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });
  }

  user.resetToken = crypto.randomUUID();
  user.resetExp = Date.now() + 60 * 60 * 1000;
  saveEmailUsers();

  if (process.env.POSTMARK_SERVER_TOKEN) {
    const resetUrl = `https://${req.headers.host || 'app.degenfeed.xyz'}/auth/reset-password?token=${user.resetToken}`;
    try {
      await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-postmark-server-token': process.env.POSTMARK_SERVER_TOKEN,
        },
        body: JSON.stringify({
          From: 'noreply@degenfeed.xyz',
          To: email,
          Subject: 'Reset your DegenFeed password',
          HtmlBody: `<p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
          MessageStream: 'outbound',
        }),
      });
    } catch {
      /* non-fatal */
    }
  }

  return jsonOk(res, {
    success: true,
    message: 'If that email is registered, a reset link has been sent.',
  });
}

async function handlePasswordResetConfirm(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`email:pw-reset-confirm:${ip}`, 3, 60_000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many reset attempts. Try again shortly.');
  }

  let body: { token?: string; password?: string };
  try {
    body = (await readBody(req)) as { token?: string; password?: string };
  } catch {
    return jsonError(res, 400, 'INVALID_BODY', 'Invalid JSON body');
  }
  if (!body.token || !body.password) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Token and new password are required');
  }
  if (body.password.length < 8) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Password must be at least 8 characters long');
  }

  const users = loadEmailUsers();
  for (const user of Object.values(users)) {
    if (user.resetToken === body.token) {
      if (user.resetExp && user.resetExp < Date.now()) {
        return jsonError(
          res,
          400,
          'EXPIRED_TOKEN',
          'Invalid or expired reset token. Please request a new one.',
        );
      }
      user.passwordHash = hashPassword(body.password);
      user.resetToken = undefined;
      user.resetExp = undefined;
      saveEmailUsers();
      return jsonOk(res, {
        success: true,
        message: 'Password reset successfully! You can now sign in with your new password.',
      });
    }
  }
  return jsonError(
    res,
    400,
    'INVALID_TOKEN',
    'Invalid or expired reset token. Please request a new one.',
  );
}

function handleEmailStatus(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const emailParam = url.searchParams.get('email');
  if (!emailParam) {
    jsonError(res, 400, 'VALIDATION_ERROR', 'Email is required');
    return;
  }

  const email = normalizeEmail(emailParam);
  if (!isValidEmail(email)) {
    jsonOk(res, { hasAccount: false, isVerified: false });
    return;
  }

  const user = loadEmailUsers()[email];
  if (!user) {
    jsonOk(res, { hasAccount: false, isVerified: false });
    return;
  }
  jsonOk(res, { hasAccount: true, isVerified: user.emailVerified });
}

// ─── Session handler ───────────────────────────────────────────────────

function handleSession(req: http.IncomingMessage, res: http.ServerResponse): void {
  const cookieValue = parseSessionCookie(req.headers.cookie || null);
  if (!cookieValue) {
    jsonOk(res, { authenticated: false, user: null });
    return;
  }

  const payload = verifySessionCookie(cookieValue);
  if (!payload) {
    jsonOk(res, { authenticated: false, user: null });
    return;
  }

  jsonOk(res, {
    authenticated: true,
    user: {
      id: payload.sub,
      provider: payload.provider,
      email: payload.email,
      displayName: payload.displayName,
    },
  });
}

function handleLogout(_req: http.IncomingMessage, res: http.ServerResponse): void {
  res.setHeader('set-cookie', clearSessionCookie());
  jsonOk(res, { success: true });
}

// ─── Router ────────────────────────────────────────────────────────────

const PROVIDERS = new Set(['google', 'github', 'discord', 'twitter', 'reddit', 'gotosocial']);

/**
 * Handle auth-related HTTP requests.
 * Returns true if the path was handled, false otherwise.
 */
export async function handleAuthRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  // GET /api/auth/session
  if (path === '/api/auth/session' && method === 'GET') {
    handleSession(req, res);
    return true;
  }

  // POST /api/auth/logout
  if (path === '/api/auth/logout' && method === 'POST') {
    handleLogout(req, res);
    return true;
  }

  // Email auth
  if (path === '/api/auth/email/register' && method === 'POST') {
    await handleEmailRegister(req, res);
    return true;
  }
  if (path === '/api/auth/email/signin' && method === 'POST') {
    await handleEmailSignIn(req, res);
    return true;
  }
  if (path === '/api/auth/email/verify' && method === 'GET') {
    await handleEmailVerify(req, res);
    return true;
  }
  if (path === '/api/auth/email/reset-request' && method === 'POST') {
    await handlePasswordResetRequest(req, res);
    return true;
  }
  if (path === '/api/auth/email/reset-confirm' && method === 'POST') {
    await handlePasswordResetConfirm(req, res);
    return true;
  }
  if (path === '/api/auth/email/status' && method === 'GET') {
    handleEmailStatus(req, res);
    return true;
  }

  // OAuth providers: /api/auth/{provider}/authorize | /callback
  const oauthMatch = path.match(/^\/api\/auth\/([a-z]+)\/(authorize|callback)$/);
  if (oauthMatch) {
    const provider = oauthMatch[1];
    const action = oauthMatch[2];
    if (!provider || !action) return false;
    if (!PROVIDERS.has(provider)) return false;
    if (action === 'authorize' && method === 'GET') {
      await handleAuthorize(provider, req, res);
      return true;
    }
    if (action === 'callback' && method === 'POST') {
      await handleCallback(provider, req, res);
      return true;
    }
    // Wrong method for a known auth path — handled to avoid falling through
    // to the catch-all stub with a fake 200.
    jsonError(res, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed for ${path}`);
    return false;
  }

  return false;
}

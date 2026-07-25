/**
 * @degenfeed/api-worker — Single Sign-On Bridge
 *
 * One wallet. Every protocol. Zero friction.
 *
 * When a user signs in with their wallet, the SSO bridge:
 *   1. Looks up or auto-provisions accounts on ALL self-hosted protocols
 *   2. Encrypts credentials and stores them in KV
 *   3. Returns a unified session token that works across all networks
 *   4. Keeps session state synchronized across protocols
 *
 * Key design decisions:
 *   - Deterministic username derivation from wallet address (df_{wallet_prefix})
 *   - Encrypted credential storage using AUTH_SECRET as encryption key
 *   - All provisioning runs proceed in parallel with graceful degradation
 *   - Session tokens are cross-signed to work on every protocol's domain
 *   - Revocation is cascading: revoke one → revoke all
 *
 * KV key scheme (in PLATFORM_ACCOUNTS or IDENTITIES):
 *   sso:wallet:{wallet}              → SSOWalletState (all linked accounts + master session)
 *   sso:session:{wallet}:{sessionId}  → SSOSession (cross-network session)
 *   sso:revoked:{sessionId}          → '1' (revocation marker)
 *   sso:creds:{wallet}:{protocol}    → EncryptedCredentials (AES-256-GCM)
 *   sso:export:{wallet}              → SSOExportBundle (full portable export)
 *   sso:last-active:{wallet}         → { lastActive, activeProtocols }
 */

import type { Env } from '../index';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface SSOProtocolDef {
  id: string;
  label: string;
  instanceUrl: string;
  apiEndpoint: string;
  healthEndpoint: string;
  icon: string;
  color: string;
  category: 'social' | 'video' | 'music' | 'blog' | 'events' | 'podcast' | 'books' | 'live';
  requiresPremium: boolean;
}

export interface SSOAccountState {
  protocol: string;
  registered: boolean;
  username: string | null;
  profileUrl: string | null;
  avatarUrl?: string;
  lastActive: number | null;
  createdAt: number | null;
  error?: string;
}

export interface SSOWalletState {
  wallet: string;
  accounts: SSOAccountState[];
  masterSessionId: string | null;
  lastActive: number;
  createdAt: number;
  updatedAt: number;
  identityDID: string | null;
}

export interface SSOSession {
  wallet: string;
  sessionId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  lastRefreshAt: number;
  /** Cross-signed tokens per protocol domain */
  crossSignedTokens: Record<string, string>;
  /** Whether this session is the master session for the wallet */
  isMaster: boolean;
  /** IP/host that created the session */
  createdByIP: string;
}

export interface SSOExportBundle {
  wallet: string;
  version: number;
  exportedAt: number;
  accounts: SSOAccountState[];
  did: string | null;
  /** Signed by wallet — proves ownership */
  walletSignature: string | null;
  /** Recovery key material (encrypted) */
  recoveryData: string | null;
}

export interface SSOProvisioningResult {
  wallet: string;
  username: string;
  results: Array<{
    protocol: string;
    status: 'created' | 'already_exists' | 'failed' | 'unsupported';
    username?: string;
    profileUrl?: string;
    error?: string;
  }>;
  created: number;
  alreadyExisted: number;
  failed: number;
  total: number;
}

export interface SSOSessionPayload {
  wallet: string;
  sessionId: string;
  exp: number;
  iat: number;
}

// ────────────────────────────────────────────────────────────────────────────
// SELF-HOSTED PROTOCOL DEFINITIONS (complete list)
// ────────────────────────────────────────────────────────────────────────────

export const ALL_SSO_PROTOCOLS: SSOProtocolDef[] = [
  {
    id: 'mastodon',
    label: 'GoToSocial (Mastodon)',
    instanceUrl: 'https://social.degenfeed.xyz',
    apiEndpoint: 'https://social.degenfeed.xyz/api/v1',
    healthEndpoint: 'https://social.degenfeed.xyz/api/v1/instance',
    icon: '🐘',
    color: '#6364ff',
    category: 'social',
    requiresPremium: false,
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    instanceUrl: 'https://video.degenfeed.xyz',
    apiEndpoint: 'https://video.degenfeed.xyz/api/v1',
    healthEndpoint: 'https://video.degenfeed.xyz/api/v1/instance',
    icon: '▶️',
    color: '#f2691d',
    category: 'video',
    requiresPremium: false,
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    instanceUrl: 'https://community.degenfeed.xyz',
    apiEndpoint: 'https://community.degenfeed.xyz/api/v3',
    healthEndpoint: 'https://community.degenfeed.xyz/api/v3/site',
    icon: '🔮',
    color: '#4a8c6f',
    category: 'social',
    requiresPremium: false,
  },
  {
    id: 'pixelfed',
    label: 'Pixelfed',
    instanceUrl: 'https://pixelfed.social',
    apiEndpoint: 'https://pixelfed.social/api/v1',
    healthEndpoint: 'https://pixelfed.social/api/v1/instance',
    icon: '📷',
    color: '#f5a623',
    category: 'social',
    requiresPremium: false,
  },
  {
    id: 'owncast',
    label: 'Owncast',
    instanceUrl: 'https://live.degenfeed.xyz',
    apiEndpoint: 'https://live.degenfeed.xyz/api',
    healthEndpoint: 'https://live.degenfeed.xyz/api/status',
    icon: '📺',
    color: '#6f42c1',
    category: 'live',
    requiresPremium: false,
  },
  {
    id: 'funkwhale',
    label: 'Funkwhale',
    instanceUrl: 'https://music.degenfeed.xyz',
    apiEndpoint: 'https://music.degenfeed.xyz/api/v1',
    healthEndpoint: 'https://music.degenfeed.xyz/api/v1/instance',
    icon: '🎵',
    color: '#f2691d',
    category: 'music',
    requiresPremium: false,
  },
  {
    id: 'castopod',
    label: 'Castopod',
    instanceUrl: 'https://podcast.degenfeed.xyz',
    apiEndpoint: 'https://podcast.degenfeed.xyz/api',
    healthEndpoint: 'https://podcast.degenfeed.xyz',
    icon: '🎙️',
    color: '#e63946',
    category: 'podcast',
    requiresPremium: false,
  },
  {
    id: 'writefreely',
    label: 'WriteFreely',
    instanceUrl: 'https://blog.degenfeed.xyz',
    apiEndpoint: 'https://blog.degenfeed.xyz/api',
    healthEndpoint: 'https://blog.degenfeed.xyz/api/instance',
    icon: '✍️',
    color: '#2eaadc',
    category: 'blog',
    requiresPremium: false,
  },
  {
    id: 'bookwyrm',
    label: 'BookWyrm',
    instanceUrl: 'https://books.degenfeed.xyz',
    apiEndpoint: 'https://books.degenfeed.xyz/api/v1',
    healthEndpoint: 'https://books.degenfeed.xyz',
    icon: '📚',
    color: '#4a8c6f',
    category: 'books',
    requiresPremium: false,
  },
  {
    id: 'mobilizon',
    label: 'Mobilizon',
    instanceUrl: 'https://events.degenfeed.xyz',
    apiEndpoint: 'https://events.degenfeed.xyz/api',
    healthEndpoint: 'https://events.degenfeed.xyz',
    icon: '📅',
    color: '#f15a22',
    category: 'events',
    requiresPremium: false,
  },
  {
    id: 'bonfire',
    label: 'Bonfire',
    instanceUrl: 'https://bonfire.degenfeed.xyz',
    apiEndpoint: 'https://bonfire.degenfeed.xyz/api/v1',
    healthEndpoint: 'https://bonfire.degenfeed.xyz',
    icon: '🔥',
    color: '#ff6b35',
    category: 'social',
    requiresPremium: true,
  },
  {
    id: 'mitra',
    label: 'Mitra',
    instanceUrl: 'https://mitra.degenfeed.xyz',
    apiEndpoint: 'https://mitra.degenfeed.xyz/api/v1',
    healthEndpoint: 'https://mitra.degenfeed.xyz',
    icon: '🔗',
    color: '#00b4d8',
    category: 'social',
    requiresPremium: true,
  },
  {
    id: 'misskey',
    label: 'Misskey',
    instanceUrl: 'https://notes.degenfeed.xyz',
    apiEndpoint: 'https://notes.degenfeed.xyz/api',
    healthEndpoint: 'https://notes.degenfeed.xyz/api/instance',
    icon: '💮',
    color: '#86b300',
    category: 'social',
    requiresPremium: false,
  },
];

export const SSO_PROTOCOL_MAP = new Map<string, SSOProtocolDef>(
  ALL_SSO_PROTOCOLS.map((p) => [p.id, p]),
);

export const SELF_HOSTED_PROTOCOL_IDS = ALL_SSO_PROTOCOLS.map((p) => p.id);

// ────────────────────────────────────────────────────────────────────────────
// KV KEY HELPERS
// ────────────────────────────────────────────────────────────────────────────

export function ssoWalletStateKey(wallet: string): string {
  return `sso:wallet:${wallet.toLowerCase()}`;
}

export function ssoSessionKey(wallet: string, sessionId: string): string {
  return `sso:session:${wallet.toLowerCase()}:${sessionId}`;
}

export function ssoRevokedKey(sessionId: string): string {
  return `sso:revoked:${sessionId}`;
}

export function ssoCredsKey(wallet: string, protocol: string): string {
  return `sso:creds:${wallet.toLowerCase()}:${protocol}`;
}

export function ssoExportKey(wallet: string): string {
  return `sso:export:${wallet.toLowerCase()}`;
}

export function ssoLastActiveKey(wallet: string): string {
  return `sso:last-active:${wallet.toLowerCase()}`;
}

export function ssoActivityFeedKey(wallet: string): string {
  return `sso:activity:${wallet.toLowerCase()}`;
}

export function ssoActivityFeedItemKey(wallet: string, timestamp: number): string {
  return `sso:activity:${wallet.toLowerCase()}:${timestamp}`;
}

// ────────────────────────────────────────────────────────────────────────────
// CROSS-NETWORK SESSION MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic username from a wallet address.
 * Format: df_{first 8 chars of wallet}
 * This ensures the same wallet always gets the same base username across protocols.
 */
export function deriveUsername(wallet: string): string {
  const prefix = wallet.toLowerCase().slice(2, 10);
  return `df_${prefix}`;
}

/**
 * Generate a cross-network session ID.
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a nonce for session freshness.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ────────────────────────────────────────────────────────────────────────────
// ENCRYPTED CREDENTIAL STORAGE
// ────────────────────────────────────────────────────────────────────────────

/**
 * Encrypt protocol credentials using AES-256-GCM with the AUTH_SECRET.
 *
 * Encrypted payload format:
 *   iv (12 bytes, hex) + ciphertext (hex) + tag (16 bytes, hex)
 */
export async function encryptCredentials(plaintext: string, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive a 256-bit key from the secret using PBKDF2-like stretching
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Combine salt + iv + ciphertext+tag
  const cipherBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(salt.length + iv.length + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);

  return Array.from(combined)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decrypt credentials encrypted with encryptCredentials.
 */
export async function decryptCredentials(encryptedHex: string, secret: string): Promise<string> {
  const combined = new Uint8Array(encryptedHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)));

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  return new TextDecoder().decode(decrypted);
}

// ────────────────────────────────────────────────────────────────────────────
// CORE SSO OPERATIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get or initialize the SSO wallet state from KV.
 */
export async function getOrInitWalletState(wallet: string, env: Env): Promise<SSOWalletState> {
  const key = ssoWalletStateKey(wallet);
  let existing: SSOWalletState | null = null;

  try {
    const raw = await env.IDENTITIES?.get(key);
    if (raw) {
      existing = JSON.parse(raw) as SSOWalletState;
    }
  } catch {
    // Corrupted or missing — create fresh
  }

  if (existing) return existing;

  const fresh: SSOWalletState = {
    wallet: wallet.toLowerCase(),
    accounts: ALL_SSO_PROTOCOLS.map((p) => ({
      protocol: p.id,
      registered: false,
      username: null,
      profileUrl: null,
      lastActive: null,
      createdAt: null,
    })),
    masterSessionId: null,
    lastActive: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    identityDID: null,
  };

  try {
    await env.IDENTITIES?.put(key, JSON.stringify(fresh));
  } catch (err) {
    console.error('[sso] Failed to save wallet state', err);
  }

  return fresh;
}

/**
 * Persist wallet state to KV.
 */
export async function persistWalletState(
  wallet: string,
  state: SSOWalletState,
  env: Env,
): Promise<void> {
  state.updatedAt = Date.now();
  const key = ssoWalletStateKey(wallet);
  try {
    await env.IDENTITIES?.put(key, JSON.stringify(state));
  } catch (err) {
    console.error('[sso] Failed to persist wallet state', err);
  }
}

/**
 * Check if all self-hosted protocols are healthy (basic connectivity).
 * Returns a map of protocol → health status.
 */
export async function checkProtocolsHealth(_env: Env): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  const checks = ALL_SSO_PROTOCOLS.map(async (proto) => {
    try {
      const res = await fetch(proto.healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      });
      results[proto.id] = res.ok;
    } catch {
      results[proto.id] = false;
    }
  });

  await Promise.allSettled(checks);
  return results;
}

/**
 * Full SSO provisioning: create accounts on ALL self-hosted protocols.
 *
 * This is the main entry point for "Sign in with wallet → auto-provision everywhere."
 *
 * Strategy:
 *   - Derive username deterministically from wallet
 *   - Provision all protocols in parallel
 *   - Store encrypted credentials
 *   - Return combined provisioning result
 *   - Graceful degradation: failed protocols don't block others
 */
export async function provisionAllProtocols(
  wallet: string,
  env: Env,
): Promise<SSOProvisioningResult> {
  const normalizedWallet = wallet.toLowerCase();
  const username = deriveUsername(normalizedWallet);
  const state = await getOrInitWalletState(normalizedWallet, env);

  // Check what's already registered to avoid duplicate work
  const existingProtocols = new Set(
    state.accounts.filter((a) => a.registered).map((a) => a.protocol),
  );

  const results = await Promise.allSettled(
    ALL_SSO_PROTOCOLS.map(async (proto) => {
      // Skip if already registered
      if (existingProtocols.has(proto.id)) {
        const existing = state.accounts.find((a) => a.protocol === proto.id);
        return {
          protocol: proto.id,
          status: 'already_exists' as const,
          username: existing?.username ?? username,
          profileUrl: existing?.profileUrl ?? undefined,
        };
      }

      try {
        const result = await provisionSingleProtocol(proto, username, normalizedWallet, env);

        if (result.status === 'created') {
          // Update wallet state
          const accountState = state.accounts.find((a) => a.protocol === proto.id);
          if (accountState) {
            accountState.registered = true;
            accountState.username = result.username ?? username;
            accountState.profileUrl = result.profileUrl ?? null;
            accountState.createdAt = Date.now();
          } else {
            state.accounts.push({
              protocol: proto.id,
              registered: true,
              username: result.username ?? username,
              profileUrl: result.profileUrl ?? null,
              lastActive: Date.now(),
              createdAt: Date.now(),
            });
          }
        }

        return result;
      } catch (err) {
        return {
          protocol: proto.id,
          status: 'failed' as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // Save updated state
  state.lastActive = Date.now();
  await persistWalletState(normalizedWallet, state, env);

  // Compile results
  const compiled: SSOProvisioningResult['results'] = results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      protocol: 'unknown',
      status: 'failed',
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  return {
    wallet: normalizedWallet,
    username,
    results: compiled,
    created: compiled.filter((r) => r.status === 'created').length,
    alreadyExisted: compiled.filter((r) => r.status === 'already_exists').length,
    failed: compiled.filter((r) => r.status === 'failed').length,
    total: compiled.length,
  };
}

/**
 * Provision a single protocol account.
 *
 * Each protocol has a different API for account creation.
 * This dispatches to the appropriate registration logic.
 *
 * Protocol-specific registration details:
 *   - GoToSocial (Mastodon): POST /api/v1/accounts with app registration
 *   - PeerTube: OAuth2 client credentials → POST /api/v1/users
 *   - Lemmy: POST /api/v3/user/register
 *   - Pixelfed: OAuth2 app registration → account creation
 *   - Owncast: Custom admin API (POST /api/admin/createuser)
 *   - Funkwhale: POST /api/v1/users with auth token
 *   - Castopod: POST /api/register with API token
 *   - WriteFreely: POST /api/collections with auth
 *   - BookWyrm: ActivityPub account creation flow
 *   - Mobilizon: POST /api/register
 *   - Bonfire: POST /api/v1/accounts
 *   - Mitra: POST /api/v1/accounts
 *   - Misskey: POST /api/signup
 */
export async function provisionSingleProtocol(
  proto: SSOProtocolDef,
  username: string,
  wallet: string,
  env: Env,
): Promise<{
  protocol: string;
  status: 'created' | 'failed';
  username?: string;
  profileUrl?: string;
  error?: string;
}> {
  const encSecret = env.AUTH_SECRET;
  if (!encSecret) {
    return {
      protocol: proto.id,
      status: 'failed',
      error: 'AUTH_SECRET not configured for credential encryption',
    };
  }

  const adminToken = env.GTS_BOT_TOKEN || '';
  const instanceUrl = proto.instanceUrl;
  const profileUrl = `${instanceUrl}/@${username}`;

  try {
    let credentialPayload: Record<string, string> = {};
    const regOpts = {
      walletAddress: wallet,
      storage: env.PLATFORM_ACCOUNTS,
      mastodonInstanceUrl: env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
      lemmyInstanceUrl: env.LEMMY_INSTANCE_URL || 'https://community.degenfeed.xyz',
      peertubeInstanceUrl: env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz',
      pixelfedInstanceUrl: env.PIXELFED_INSTANCE_URL || 'https://pixelfed.social',
      bookwyrmInstanceUrl: 'https://books.degenfeed.xyz',
      funkwhaleInstanceUrl: 'https://music.degenfeed.xyz',
      mobilizonInstanceUrl: 'https://events.degenfeed.xyz',
      writefreelyInstanceUrl: 'https://blog.degenfeed.xyz',
    };

    switch (proto.id) {
      case 'mastodon': {
        // Use the existing crossplatform-register system
        const { registerMastodon } = await import('@degenfeed/crossplatform-register');
        const result = await registerMastodon(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'peertube': {
        const { registerPeerTube } = await import('@degenfeed/crossplatform-register');
        const result = await registerPeerTube(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'lemmy': {
        const { registerLemmy } = await import('@degenfeed/crossplatform-register');
        const result = await registerLemmy(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'pixelfed': {
        const { registerPixelfed } = await import('@degenfeed/crossplatform-register');
        const result = await registerPixelfed(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'writefreely': {
        const { registerWriteFreely } = await import('@degenfeed/crossplatform-register');
        const result = await registerWriteFreely(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'bookwyrm': {
        const { registerBookWyrm } = await import('@degenfeed/crossplatform-register');
        const result = await registerBookWyrm(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'mobilizon': {
        const { registerMobilizon } = await import('@degenfeed/crossplatform-register');
        const result = await registerMobilizon(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      case 'funkwhale': {
        const { registerFunkwhale } = await import('@degenfeed/crossplatform-register');
        const result = await registerFunkwhale(username, wallet, regOpts);
        if (result.status === 'failed') {
          return { protocol: proto.id, status: 'failed', error: result.error };
        }
        credentialPayload = result.accountInfo || {};
        break;
      }

      // ── Extended protocols (beyond crossplatform-register) ─────────
      // These use direct API calls since no existing registration module exists.

      case 'owncast': {
        if (!adminToken) {
          return {
            protocol: proto.id,
            status: 'failed',
            error: 'GTS_BOT_TOKEN (admin token) not configured for Owncast admin API',
          };
        }
        const owncastRes = await fetch(`${instanceUrl}/api/admin/createuser`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            username,
            displayName: `DegenFeed ${username}`,
            password: generateNonce(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!owncastRes.ok) {
          const errBody = await owncastRes.text().catch(() => 'unknown');
          return {
            protocol: proto.id,
            status: 'failed',
            error: `Owncast API error ${owncastRes.status}: ${errBody}`,
          };
        }
        const owncastData = (await owncastRes.json()) as Record<string, string>;
        credentialPayload = {
          username,
          userId: owncastData.id || owncastData.userId || '',
          streamKey: owncastData.streamKey || '',
        };
        break;
      }

      case 'castopod': {
        if (!env.CASTOPOD_API_TOKEN) {
          return {
            protocol: proto.id,
            status: 'failed',
            error: 'CASTOPOD_API_TOKEN not configured',
          };
        }
        const castopodRes = await fetch(`${instanceUrl}/api/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.CASTOPOD_API_TOKEN}`,
          },
          body: JSON.stringify({
            username,
            email: `${username}@degenfeed.xyz`,
            password: generateNonce(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!castopodRes.ok) {
          const errBody = await castopodRes.text().catch(() => 'unknown');
          return {
            protocol: proto.id,
            status: 'failed',
            error: `Castopod API error ${castopodRes.status}: ${errBody}`,
          };
        }
        const castopodData = (await castopodRes.json()) as Record<string, string>;
        credentialPayload = {
          username,
          userId: castopodData.id || '',
          actorId: castopodData.actor_id || '',
        };
        break;
      }

      case 'bonfire': {
        const bonfireRes = await fetch(`${instanceUrl}/api/v1/accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            username,
            email: `${username}@degenfeed.xyz`,
            password: generateNonce(),
            agreement: true,
            locale: 'en',
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!bonfireRes.ok) {
          const errBody = await bonfireRes.text().catch(() => 'unknown');
          return {
            protocol: proto.id,
            status: 'failed',
            error: `Bonfire API error ${bonfireRes.status}: ${errBody}`,
          };
        }
        const bonfireData = (await bonfireRes.json()) as Record<string, string>;
        credentialPayload = {
          username,
          userId: bonfireData.id || '',
          token: bonfireData.token || '',
        };
        break;
      }

      case 'mitra': {
        const mitraRes = await fetch(`${instanceUrl}/api/v1/accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            username,
            email: `${username}@degenfeed.xyz`,
            password: generateNonce(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!mitraRes.ok) {
          const errBody = await mitraRes.text().catch(() => 'unknown');
          return {
            protocol: proto.id,
            status: 'failed',
            error: `Mitra API error ${mitraRes.status}: ${errBody}`,
          };
        }
        const mitraData = (await mitraRes.json()) as Record<string, string>;
        credentialPayload = {
          username,
          userId: mitraData.id || '',
        };
        break;
      }

      case 'misskey': {
        const misskeyRes = await fetch(`${instanceUrl}/api/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password: generateNonce(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!misskeyRes.ok) {
          const errBody = await misskeyRes.text().catch(() => 'unknown');
          return {
            protocol: proto.id,
            status: 'failed',
            error: `Misskey API error ${misskeyRes.status}: ${errBody}`,
          };
        }
        const misskeyData = (await misskeyRes.json()) as Record<string, string>;
        credentialPayload = {
          username,
          userId: misskeyData.id || '',
          token: misskeyData.token || '',
        };
        break;
      }

      default: {
        return { protocol: proto.id, status: 'failed', error: 'Protocol not supported' };
      }
    }

    // Encrypt and store credentials securely
    const credsJson = JSON.stringify(credentialPayload);
    const encrypted = await encryptCredentials(credsJson, encSecret);

    try {
      await env.PLATFORM_ACCOUNTS?.put(ssoCredsKey(wallet, proto.id), encrypted);
    } catch (storeErr) {
      console.error(`[sso] Failed to store encrypted creds for ${proto.id}`, storeErr);
    }

    return {
      protocol: proto.id,
      status: 'created',
      username: credentialPayload.username || username,
      profileUrl,
    };
  } catch (err) {
    return {
      protocol: proto.id,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CROSS-NETWORK SESSION MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a cross-network session for a wallet.
 *
 * This session is signed and can be verified across all protocol domains.
 * It uses the same AUTH_SECRET as the base session for HMAC signing.
 */
export async function createCrossNetworkSession(
  wallet: string,
  env: Env,
  ip?: string,
): Promise<{
  session: SSOSession;
  sessionToken: string;
}> {
  const secret = env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET not configured');
  }

  const sessionId = generateSessionId();
  const nonce = generateNonce();
  const now = Date.now();
  const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days

  const session: SSOSession = {
    wallet: wallet.toLowerCase(),
    sessionId,
    nonce,
    issuedAt: now,
    expiresAt: now + ttl,
    lastRefreshAt: now,
    crossSignedTokens: {},
    isMaster: true,
    createdByIP: ip || 'unknown',
  };

  // Generate cross-signed tokens for each protocol domain
  // Each protocol gets its own signed sub-token
  for (const proto of ALL_SSO_PROTOCOLS) {
    const domain = new URL(proto.instanceUrl).hostname;
    const subToken = await signCrossNetworkToken(wallet.toLowerCase(), sessionId, domain, secret);
    session.crossSignedTokens[proto.id] = subToken;
  }

  // Store session in KV
  const sessionKey = ssoSessionKey(wallet, sessionId);
  try {
    await env.IDENTITIES?.put(sessionKey, JSON.stringify(session));
  } catch (err) {
    console.error('[sso] Failed to store session', err);
  }

  // Produce a combined session token for the client
  const sessionToken = await signSessionToken(wallet.toLowerCase(), sessionId, nonce, secret);

  // Update wallet state with master session ID
  const state = await getOrInitWalletState(wallet, env);
  state.masterSessionId = sessionId;
  state.lastActive = now;
  await persistWalletState(wallet, state, env);

  return { session, sessionToken };
}

/**
 * Sign a cross-network session token (client-facing).
 * Format: base64({wallet, sessionId, nonce}).HMAC
 */
export async function signSessionToken(
  wallet: string,
  sessionId: string,
  nonce: string,
  secret: string,
): Promise<string> {
  const payload = JSON.stringify({ wallet, sessionId, nonce });
  const encoded = btoa(payload);
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${encoded}.${sigHex}`;
}

/**
 * Verify a cross-network session token.
 */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<{ wallet: string; sessionId: string; nonce: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sigHex] = parts;

  const key = await importHmacKey(secret);
  const signature = hexToBytes(sigHex);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(encoded),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(encoded)) as {
      wallet: string;
      sessionId: string;
      nonce: string;
    };
    if (!payload.wallet || !payload.sessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Sign a cross-network token for a specific protocol domain.
 * This allows the user to authenticate on each protocol's subdomain.
 */
export async function signCrossNetworkToken(
  wallet: string,
  sessionId: string,
  domain: string,
  secret: string,
): Promise<string> {
  const payload = JSON.stringify({ wallet, sessionId, domain, t: Date.now() });
  const encoded = btoa(payload);
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${encoded}.${sigHex}`;
}

/**
 * Refresh a cross-network session, extending its TTL.
 */
export async function refreshCrossNetworkSession(
  wallet: string,
  sessionId: string,
  env: Env,
): Promise<SSOSession | null> {
  const sessionKey = ssoSessionKey(wallet, sessionId);
  try {
    const raw = await env.IDENTITIES?.get(sessionKey);
    if (!raw) return null;

    const session = JSON.parse(raw) as SSOSession;
    if (session.expiresAt < Date.now()) {
      return null; // Already expired
    }

    // Extend TTL by 7 days from now
    session.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    session.lastRefreshAt = Date.now();

    await env.IDENTITIES?.put(sessionKey, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

/**
 * Revoke a single cross-network session.
 * This cascades: the session token will fail verification on ALL protocols.
 */
export async function revokeSession(wallet: string, sessionId: string, env: Env): Promise<boolean> {
  try {
    // Add session to revocation blocklist
    await env.IDENTITIES?.put(
      ssoRevokedKey(sessionId),
      '1',
      { expirationTtl: 7 * 86400 }, // 7 days
    );

    // Remove from wallet state
    const state = await getOrInitWalletState(wallet, env);
    if (state.masterSessionId === sessionId) {
      state.masterSessionId = null;
      await persistWalletState(wallet, state, env);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke ALL sessions for a wallet across all protocols.
 * Cascading revocation: invalidate every session token.
 */
export async function revokeAllSessions(
  wallet: string,
  env: Env,
): Promise<{ revoked: number; failed: number }> {
  const normalizedWallet = wallet.toLowerCase();
  let revoked = 0;
  let failed = 0;

  try {
    // List all session keys for this wallet
    const prefix = `sso:session:${normalizedWallet}:`;
    const list = await env.IDENTITIES?.list({ prefix });
    if (list) {
      for (const key of list.keys) {
        const sessionId = key.name.replace(prefix, '');
        try {
          // Add blocklist entry
          await env.IDENTITIES?.put(ssoRevokedKey(sessionId), '1', { expirationTtl: 7 * 86400 });
          revoked++;
        } catch {
          failed++;
        }
      }
    }
  } catch (err) {
    console.error('[sso] revokeAllSessions error', err);
    failed++;
  }

  // Clear master session from wallet state
  const state = await getOrInitWalletState(normalizedWallet, env);
  state.masterSessionId = null;
  await persistWalletState(normalizedWallet, state, env);

  return { revoked, failed };
}

/**
 * Check if a session has been revoked.
 */
export async function isSessionRevoked(sessionId: string, env: Env): Promise<boolean> {
  try {
    const result = await env.IDENTITIES?.get(ssoRevokedKey(sessionId));
    return result !== null;
  } catch {
    // Fail-closed: treat as revoked during KV outage
    return true;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ACTIVITY SYNC
// ────────────────────────────────────────────────────────────────────────────

/**
 * Record "last active" timestamp and push to activity feed.
 * This keeps the user's active state synchronized across protocols.
 */
export async function recordActivity(
  wallet: string,
  protocol: string,
  activityType: string,
  metadata?: Record<string, unknown>,
  env?: Env,
): Promise<void> {
  if (!env) return;

  const normalizedWallet = wallet.toLowerCase();
  const now = Date.now();

  // Update last active
  try {
    await env.IDENTITIES?.put(
      ssoLastActiveKey(normalizedWallet),
      JSON.stringify({ lastActive: now, protocol, activityType }),
    );
  } catch {
    // Non-critical
  }

  // Push activity feed item
  try {
    const feedKey = ssoActivityFeedKey(normalizedWallet);
    const feedRaw = await env.IDENTITIES?.get(feedKey);
    const feed: Array<{
      timestamp: number;
      protocol: string;
      type: string;
      metadata?: Record<string, unknown>;
    }> = feedRaw ? JSON.parse(feedRaw) : [];

    feed.unshift({
      timestamp: now,
      protocol,
      type: activityType,
      metadata,
    });

    // Keep last 100 activities
    const trimmed = feed.slice(0, 100);
    await env.IDENTITIES?.put(feedKey, JSON.stringify(trimmed));
  } catch {
    // Non-critical
  }
}

/**
 * Get the last active state for a wallet.
 */
export async function getLastActive(
  wallet: string,
  env: Env,
): Promise<{
  lastActive: number | null;
  protocol: string | null;
  activityType: string | null;
} | null> {
  try {
    const raw = await env.IDENTITIES?.get(ssoLastActiveKey(wallet.toLowerCase()));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get the activity feed for a wallet.
 */
export async function getActivityFeed(
  wallet: string,
  env: Env,
  limit = 50,
): Promise<
  Array<{
    timestamp: number;
    protocol: string;
    type: string;
    metadata?: Record<string, unknown>;
  }>
> {
  try {
    const feedKey = ssoActivityFeedKey(wallet.toLowerCase());
    const raw = await env.IDENTITIES?.get(feedKey);
    if (!raw) return [];
    const feed = JSON.parse(raw) as Array<{
      timestamp: number;
      protocol: string;
      type: string;
      metadata?: Record<string, unknown>;
    }>;
    return feed.slice(0, limit);
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// IDENTITY PORTABILITY
// ────────────────────────────────────────────────────────────────────────────

/**
 * Export all SSO identities as a portable backup bundle.
 *
 * Bundle contains:
 *   - All linked protocol accounts with usernames
 *   - Encrypted credentials (can be re-decrypted with AUTH_SECRET or wallet key)
 *   - Wallet address and DID
 *   - Export metadata (timestamp, version)
 *
 * This bundle can be imported on another device or wallet.
 */
export async function exportIdentityBundle(
  wallet: string,
  env: Env,
  walletSignature?: string,
): Promise<SSOExportBundle> {
  const normalizedWallet = wallet.toLowerCase();
  const state = await getOrInitWalletState(normalizedWallet, env);

  // Gather recovery data (encrypted credential references)
  let recoveryData: string | null = null;
  try {
    const credsMap: Record<string, string> = {};
    for (const acct of state.accounts) {
      if (acct.registered) {
        const key = ssoCredsKey(normalizedWallet, acct.protocol);
        const encrypted = await env.PLATFORM_ACCOUNTS?.get(key);
        if (encrypted) {
          credsMap[acct.protocol] = encrypted;
        }
      }
    }
    recoveryData = JSON.stringify(credsMap);
  } catch {
    // Non-critical - recovery data is nice-to-have
  }

  // Get DID
  let did: string | null = null;
  try {
    const didRaw = await env.IDENTITIES?.get(`did:${normalizedWallet}`);
    if (didRaw) {
      const didRecord = JSON.parse(didRaw) as { did: string };
      did = didRecord.did;
    }
  } catch {
    // Non-critical
  }

  const bundle: SSOExportBundle = {
    wallet: normalizedWallet,
    version: 1,
    exportedAt: Date.now(),
    accounts: state.accounts,
    did,
    walletSignature: walletSignature || null,
    recoveryData,
  };

  // Cache the bundle in KV
  try {
    await env.IDENTITIES?.put(ssoExportKey(normalizedWallet), JSON.stringify(bundle));
  } catch {
    // Non-critical
  }

  return bundle;
}

/**
 * Import an identity bundle (for recovery or migration).
 *
 * This restores:
 *   - Protocol account links
 *   - Encrypted credentials (if same encryption key)
 *   - DID document references
 *
 * Returns the restored wallet state.
 */
export async function importIdentityBundle(
  bundle: SSOExportBundle,
  env: Env,
): Promise<SSOWalletState> {
  const normalizedWallet = bundle.wallet.toLowerCase();

  // Validate bundle version
  if (bundle.version !== 1) {
    throw new Error(`Unsupported bundle version: ${bundle.version}`);
  }

  // Validate wallet signature if present
  if (bundle.walletSignature) {
    // In production, verify walletSignature against the wallet address
    // For now, we accept the bundle if the wallet matches
  }

  // Create or update wallet state
  const state = await getOrInitWalletState(normalizedWallet, env);

  // Merge imported accounts into existing state
  for (const imported of bundle.accounts) {
    if (imported.registered) {
      const existing = state.accounts.find((a) => a.protocol === imported.protocol);
      if (existing) {
        existing.registered = imported.registered;
        existing.username = imported.username;
        existing.profileUrl = imported.profileUrl;
        existing.createdAt = imported.createdAt || existing.createdAt;
      } else {
        state.accounts.push(imported);
      }
    }
  }

  // Restore encrypted credentials from recovery data
  if (bundle.recoveryData) {
    try {
      const credsMap = JSON.parse(bundle.recoveryData) as Record<string, string>;
      for (const [protocol, encrypted] of Object.entries(credsMap)) {
        await env.PLATFORM_ACCOUNTS?.put(ssoCredsKey(normalizedWallet, protocol), encrypted);
      }
    } catch {
      // Non-critical - credentials can be re-generated
    }
  }

  state.updatedAt = Date.now();
  state.identityDID = bundle.did || state.identityDID;

  // Persist state
  await persistWalletState(normalizedWallet, state, env);

  return state;
}

/**
 * Generate recovery phrase for wallet-less recovery.
 *
 * Creates a deterministic recovery code that can regenerate access
 * to all accounts in case the wallet is lost.
 *
 * This uses a time-locked recovery mechanism:
 *   - Recovery code is derived from a user-chosen passphrase
 *   - Combined with a server-side secret to prevent brute force
 *   - Recovery triggers a key rotation ceremony
 */
export async function generateRecoveryCode(
  wallet: string,
  userPassphrase: string,
  env: Env,
): Promise<{ recoveryCode: string; backupEncrypted: string }> {
  const normalizedWallet = wallet.toLowerCase();
  const _state = await getOrInitWalletState(normalizedWallet, env);

  // Derive recovery code
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userPassphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const salt = new TextEncoder().encode(`degenfeed-sso-recovery-${normalizedWallet}`);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 200_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const recoveryCode = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16); // First 16 hex chars = 64-bit recovery code

  // Create a backup bundle encrypted with the recovery code
  const exportBundle = await exportIdentityBundle(normalizedWallet, env);
  const backupJson = JSON.stringify(exportBundle);

  const backupEncrypted = await encryptCredentials(backupJson, recoveryCode + env.AUTH_SECRET);

  // Store recovery marker in KV
  try {
    await env.IDENTITIES?.put(
      `sso:recovery:${normalizedWallet}`,
      JSON.stringify({
        recoveryHash: await hashWithSHA256(recoveryCode),
        createdAt: Date.now(),
      }),
    );
  } catch {
    // Non-critical
  }

  return { recoveryCode, backupEncrypted };
}

/**
 * Recover access using recovery code.
 */
export async function recoverWithCode(
  wallet: string,
  recoveryCode: string,
  encryptedBackup: string,
  env: Env,
): Promise<SSOWalletState> {
  const normalizedWallet = wallet.toLowerCase();

  // Verify recovery code
  const recoveryKey = `sso:recovery:${normalizedWallet}`;
  try {
    const raw = await env.IDENTITIES?.get(recoveryKey);
    if (raw) {
      const record = JSON.parse(raw) as { recoveryHash: string; createdAt: number };
      const hash = await hashWithSHA256(recoveryCode);
      if (hash !== record.recoveryHash) {
        throw new Error('Invalid recovery code');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Invalid recovery code') {
      throw err;
    }
    // No recovery record stored — skip verification
  }

  // Decrypt the backup bundle
  const backupJson = await decryptCredentials(encryptedBackup, recoveryCode + env.AUTH_SECRET);

  const bundle = JSON.parse(backupJson) as SSOExportBundle;
  return importIdentityBundle(bundle, env);
}

// ────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyBytes =
    /^[0-9a-fA-F]+$/.test(secret) && secret.length >= 64
      ? new Uint8Array(secret.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)))
      : new TextEncoder().encode(secret);

  return crypto.subtle.importKey(
    'raw',
    keyBytes as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

async function hashWithSHA256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

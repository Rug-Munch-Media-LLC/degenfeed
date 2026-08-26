/**
 * @degenfeed/api-worker — SSO Bridge Implementation
 *
 * Single Sign-On bridge across all self-hosted protocol instances.
 * Provides session management, identity provisioning, and cross-network activity tracking.
 *
 * Storage: SSO records (sessions, wallet state, export bundles, recovery
 * codes, activity feeds, last-active) are persisted to rmi-backend via the
 * generic /api/v1/sessions store (id → JSON blob with TTL), with the legacy
 * IDENTITIES KV namespace kept as a warm fallback when the API is down.
 */

import { registerOnPlatform } from '@degenfeed/crossplatform-register';
import type { Env } from '../../index';
import { sealForWallet } from '../crypto-seal';
import { getSession, setSession } from '../rmi-client';
import {
  ALL_SSO_PROTOCOLS,
  SSO_PROTOCOL_MAP,
  ssoActivityFeedKey,
  ssoExportKey,
  ssoLastActiveKey,
  ssoRevokedKey,
  ssoSessionKey,
  ssoWalletStateKey,
} from './constants';
import type { SSOAccountState, SSOExportBundle, SSOSession, SSOWalletState } from './types';

// ─── Persistent store helpers (rmi-backend primary, KV fallback) ──────
//
// SSO records are arbitrary-id key/value blobs. The rmi-backend /sessions
// API is the closest persistent store (id → data with TTL), so SSO writes go
// there as `{ value: <raw JSON string> }`; every read unwraps `data.value`.
// The legacy IDENTITIES KV namespace remains the fallback when the API is
// unreachable. KV access uses optional chaining because IDENTITIES is
// unbound in local/dev environments.

async function ssoStoreGet(env: Env, id: string): Promise<string | null> {
  try {
    const data = await getSession(env, id);
    const raw = data && typeof data.value === 'string' ? data.value : null;
    if (raw !== null) return raw;
  } catch {
    // API unavailable — fall through to KV
  }
  try {
    return (await env.IDENTITIES?.get(id)) ?? null;
  } catch {
    return null;
  }
}

async function ssoStoreSet(env: Env, id: string, value: string, ttl?: number): Promise<void> {
  try {
    await setSession(env, id, { value }, ttl ?? 86400);
  } catch {
    // API unavailable — KV below is the fallback persistence
  }
  try {
    await env.IDENTITIES?.put(id, value, ttl ? { expirationTtl: ttl } : undefined);
  } catch {
    // Non-critical mirror
  }
}

// ─── Protocol Health ──────────────────────────────────────────────────

export async function checkProtocolsHealth(_env: Env): Promise<Record<string, boolean>> {
  const health: Record<string, boolean> = {};
  for (const [id, def] of Object.entries(SSO_PROTOCOL_MAP)) {
    try {
      const res = await fetch(def.healthEndpoint, { signal: AbortSignal.timeout(5000) });
      health[id] = res.ok;
    } catch {
      health[id] = false;
    }
  }
  return health;
}

// ─── Session Management ────────────────────────────────────────────────

export async function createCrossNetworkSession(
  walletAddress: string,
  env: Env,
): Promise<SSOSession> {
  const nonce = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours
  const session: SSOSession = {
    sessionId: nonce,
    wallet: walletAddress,
    protocols: ALL_SSO_PROTOCOLS.map((p) => p.id),
    createdAt: now,
    expiresAt,
    lastUsed: now,
    issuedAt: now,
  };
  await ssoStoreSet(env, ssoSessionKey(nonce, nonce), JSON.stringify(session), 86400);
  return session;
}

export async function refreshCrossNetworkSession(
  nonce: string,
  env: Env,
): Promise<SSOSession | null> {
  const raw = await ssoStoreGet(env, ssoSessionKey(nonce, nonce));
  if (!raw) return null;
  const session: SSOSession = JSON.parse(raw);
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  session.lastUsed = Date.now();
  await ssoStoreSet(env, ssoSessionKey(nonce, nonce), JSON.stringify(session), 86400);
  return session;
}

export async function verifySessionToken(token: string, env: Env): Promise<SSOSession | null> {
  const raw = await ssoStoreGet(env, ssoSessionKey(token, token));
  if (!raw) return null;
  const session: SSOSession = JSON.parse(raw);
  if (session.expiresAt < Date.now()) return null;
  const revoked = await ssoStoreGet(env, ssoRevokedKey(token));
  if (revoked) return null;
  return session;
}

export async function signSessionToken(session: SSOSession): Promise<string> {
  // In production, use a proper JWT or similar
  return session.sessionId;
}

export async function revokeSession(nonce: string, env: Env): Promise<boolean> {
  await ssoStoreSet(env, ssoRevokedKey(nonce), '1', 86400 * 7);
  return true;
}

export async function revokeAllSessions(walletAddress: string, env: Env): Promise<number> {
  // Revoke the current sessions by listing SSO session keys from KV.
  let count = 0;
  try {
    const list = await env.IDENTITIES?.list({ prefix: 'sso:session:' });
    for (const key of list?.keys ?? []) {
      const raw = await ssoStoreGet(env, key.name);
      if (raw) {
        const session: SSOSession = JSON.parse(raw);
        if (session.wallet === walletAddress) {
          await revokeSession(session.sessionId, env);
          count++;
        }
      }
    }
  } catch {
    // list unavailable — best-effort revocation
  }
  return count;
}

export async function isSessionRevoked(nonce: string, env: Env): Promise<boolean> {
  const revoked = await ssoStoreGet(env, ssoRevokedKey(nonce));
  return revoked !== null;
}

// ─── Wallet State ──────────────────────────────────────────────────────

/** Persist wallet state to the SSO store (shared by dashboard + bridge flows). */
export async function persistWalletState(
  walletAddress: string,
  state: SSOWalletState,
  env: Env,
): Promise<void> {
  await ssoStoreSet(env, ssoWalletStateKey(walletAddress), JSON.stringify(state));
}

export async function getOrInitWalletState(
  walletAddress: string,
  env: Env,
): Promise<SSOWalletState> {
  const raw = await ssoStoreGet(env, ssoWalletStateKey(walletAddress));
  if (raw) return JSON.parse(raw) as SSOWalletState;
  const state: SSOWalletState = {
    wallet: walletAddress,
    accounts: [],
    masterSessionId: null,
    lastActive: Date.now(),
    provisionedAt: Date.now(),
  };
  await ssoStoreSet(env, ssoWalletStateKey(walletAddress), JSON.stringify(state));
  return state;
}

// ─── Provisioning ──────────────────────────────────────────────────────

// Mapping from SSO protocol IDs to the instance URL fields used by registerOnPlatform
const PROTOCOL_USERNAME_EMAIL_MAP: Record<string, { instanceUrlKey: string; defaultUrl: string }> =
  {
    nostr: { instanceUrlKey: 'nostrRelayUrl', defaultUrl: 'ws://127.0.0.1:8085' },
    mastodon: { instanceUrlKey: 'mastodonInstanceUrl', defaultUrl: 'https://social.degenfeed.xyz' },
    lemmy: { instanceUrlKey: 'lemmyInstanceUrl', defaultUrl: 'https://community.degenfeed.xyz' },
    bluesky: { instanceUrlKey: 'bskyPdsUrl', defaultUrl: 'https://pds.degenfeed.xyz' },
    pixelfed: { instanceUrlKey: 'pixelfedInstanceUrl', defaultUrl: 'https://photos.degenfeed.xyz' },
    peertube: { instanceUrlKey: 'peertubeInstanceUrl', defaultUrl: 'https://video.degenfeed.xyz' },
    writefreely: {
      instanceUrlKey: 'writefreelyInstanceUrl',
      defaultUrl: 'https://blog.degenfeed.xyz',
    },
    owncast: { instanceUrlKey: 'owncastInstanceUrl', defaultUrl: 'https://live.degenfeed.xyz' },
    castopod: {
      instanceUrlKey: 'castopodInstanceUrl',
      defaultUrl: 'https://podcast.degenfeed.xyz',
    },
  };

/**
 * Provision accounts on ALL SSO protocols for a given wallet.
 * Actually calls the individual service registration APIs.
 */
export async function provisionAllProtocols(
  walletAddress: string,
  env: Env,
): Promise<{
  provisioned: string[];
  alreadyExisted: number;
  created: number;
  failed: string[];
  results: Array<{ protocol: string; ok: boolean; username?: string; error?: string }>;
}> {
  const provisioned: string[] = [];
  const failed: string[] = [];
  let createdCount = 0;
  let alreadyExistedCount = 0;
  const results: Array<{ protocol: string; ok: boolean; username?: string; error?: string }> = [];

  // Get wallet state for username/identity info
  const state = await getOrInitWalletState(walletAddress, env);

  // Derive a username from the wallet address for cross-service registration
  const username = `df${walletAddress.slice(2, 10)}`;
  for (const protocolDef of ALL_SSO_PROTOCOLS) {
    const protocolId = protocolDef.id;

    // Skip protocols that are already provisioned in wallet state
    const existingAccount = state.accounts.find((a) => a.protocol === protocolId);
    if (existingAccount?.registered) {
      alreadyExistedCount++;
      provisioned.push(protocolId);
      results.push({
        protocol: protocolId,
        ok: true,
        username: existingAccount.username || undefined,
      });
      continue;
    }

    try {
      // Build register opts with proper instance URLs
      const protoConfig = PROTOCOL_USERNAME_EMAIL_MAP[protocolId];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: Record<string, any> = {
        walletAddress,
        storage: env.PLATFORM_ACCOUNTS,
        sealSecret: (plaintext: string) =>
          sealForWallet(env, plaintext, walletAddress, 'protocol-key'),
      };
      if (protoConfig) {
        opts[protoConfig.instanceUrlKey] = protoConfig.defaultUrl;
      }

      const registration = await registerOnPlatform(
        protocolId,
        username,
        walletAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opts as any,
      );

      if (registration.status === 'created' || registration.status === 'pending') {
        createdCount++;
        provisioned.push(protocolId);
        results.push({
          protocol: protocolId,
          ok: true,
          username: registration.username,
          error: registration.status === 'pending' ? registration.error : undefined,
        });

        // Update wallet state with actual account info
        state.accounts.push({
          protocol: protocolId,
          registered: registration.status === 'created',
          username: registration.username || username,
          profileUrl: registration.accountInfo?.profileUrl || null,
          lastActive: Date.now(),
          createdAt: Date.now(),
        } as SSOAccountState);

        //         console.log(
        //           `[sso-bridge] Provisioned ${protocolId} for ${walletAddress.slice(0, 8)} as ${registration.username}`,
        //         );
      } else {
        failed.push(protocolId);
        results.push({
          protocol: protocolId,
          ok: false,
          error: registration.error || 'Registration returned failed status',
        });
        console.warn(
          `[sso-bridge] Failed to provision ${protocolId} for ${walletAddress.slice(0, 8)}: ${registration.error}`,
        );
      }
    } catch (err) {
      failed.push(protocolId);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results.push({ protocol: protocolId, ok: false, error: msg });
      console.warn(
        `[sso-bridge] Error provisioning ${protocolId} for ${walletAddress.slice(0, 8)}: ${msg}`,
      );
    }
  }

  // Persist updated wallet state
  await ssoStoreSet(env, ssoWalletStateKey(walletAddress), JSON.stringify(state));

  return {
    provisioned,
    alreadyExisted: alreadyExistedCount,
    created: createdCount,
    failed,
    results,
  };
}

/**
 * Provision a single SSO protocol for a given wallet.
 * Actually calls the service registration API.
 */
export async function provisionSingleProtocol(
  walletAddress: string,
  protocolId: string,
  env: Env,
): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
  /** 'created' | 'pending' | 'failed' — mirrors registerOnPlatform's verdict */
  status?: 'created' | 'pending' | 'failed';
  profileUrl?: string;
}> {
  const username = `df${walletAddress.slice(2, 10)}`;
  try {
    const protoConfig = PROTOCOL_USERNAME_EMAIL_MAP[protocolId];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: Record<string, any> = {
      walletAddress,
      storage: env.PLATFORM_ACCOUNTS,
      sealSecret: (plaintext: string) =>
        sealForWallet(env, plaintext, walletAddress, 'protocol-key'),
    };
    if (protoConfig) {
      opts[protoConfig.instanceUrlKey] = protoConfig.defaultUrl;
    }

    const registration = await registerOnPlatform(
      protocolId,
      username,
      walletAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opts as any,
    );

    if (registration.status === 'created' || registration.status === 'pending') {
      // Update wallet state
      const state = await getOrInitWalletState(walletAddress, env);
      state.accounts.push({
        protocol: protocolId,
        registered: registration.status === 'created',
        username: registration.username || username,
        profileUrl: registration.accountInfo?.profileUrl || null,
        lastActive: Date.now(),
        createdAt: Date.now(),
      } as SSOAccountState);
      await ssoStoreSet(env, ssoWalletStateKey(walletAddress), JSON.stringify(state));

      //       console.log(
      //         `[sso-bridge] Provisioned single ${protocolId} for ${walletAddress.slice(0, 8)} as ${registration.username}`,
      //       );

      return {
        ok: true,
        username: registration.username,
        error: registration.status === 'pending' ? registration.error : undefined,
        status: registration.status === 'pending' ? 'pending' : 'created',
        profileUrl: registration.accountInfo?.profileUrl || undefined,
      };
    }

    return {
      ok: false,
      error: registration.error || 'Registration returned failed status',
      status: 'failed',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn(
      `[sso-bridge] Error provisioning single ${protocolId} for ${walletAddress.slice(0, 8)}: ${msg}`,
    );
    return { ok: false, error: msg };
  }
}

// ─── Identity Bundle ───────────────────────────────────────────────────

export async function exportIdentityBundle(
  walletAddress: string,
  env: Env,
): Promise<SSOExportBundle | null> {
  const raw = await ssoStoreGet(env, ssoExportKey(walletAddress));
  if (!raw) return null;
  return JSON.parse(raw) as SSOExportBundle;
}

export async function importIdentityBundle(
  walletAddress: string,
  bundle: SSOExportBundle,
  env: Env,
): Promise<boolean> {
  await ssoStoreSet(env, ssoExportKey(walletAddress), JSON.stringify(bundle));
  return true;
}

// ─── Recovery ──────────────────────────────────────────────────────────

export async function generateRecoveryCode(walletAddress: string, env: Env): Promise<string> {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await ssoStoreSet(env, `recovery:${code}`, walletAddress, 86400 * 7);
  return code;
}

export async function recoverWithCode(code: string, env: Env): Promise<string | null> {
  return ssoStoreGet(env, `recovery:${code}`);
}

// ─── Activity ──────────────────────────────────────────────────────────

export async function getActivityFeed(
  walletAddress: string,
  env: Env,
  limit = 50,
): Promise<Array<{ type: string; protocol: string; timestamp: number; data: string }>> {
  const raw = await ssoStoreGet(env, ssoActivityFeedKey(walletAddress));
  if (!raw) return [];
  const activities = JSON.parse(raw) as Array<{
    type: string;
    protocol: string;
    timestamp: number;
    data: string;
  }>;
  return activities.slice(0, limit);
}

export async function recordActivity(
  walletAddress: string,
  type: string,
  protocol: string,
  data: string,
  env: Env,
): Promise<void> {
  const raw = await ssoStoreGet(env, ssoActivityFeedKey(walletAddress));
  const activities = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
  activities.unshift({ type, protocol, timestamp: Date.now(), data });
  if (activities.length > 200) activities.length = 200;
  await ssoStoreSet(env, ssoActivityFeedKey(walletAddress), JSON.stringify(activities));
}

export async function getLastActive(walletAddress: string, env: Env): Promise<number | null> {
  const raw = await ssoStoreGet(env, ssoLastActiveKey(walletAddress));
  return raw ? parseInt(raw, 10) : null;
}

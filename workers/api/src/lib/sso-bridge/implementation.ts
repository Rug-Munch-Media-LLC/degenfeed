/**
 * @degenfeed/api-worker — SSO Bridge Implementation
 *
 * Single Sign-On bridge across all self-hosted protocol instances.
 * Provides session management, identity provisioning, and cross-network activity tracking.
 */

import { registerOnPlatform } from '@degenfeed/crossplatform-register';
import type { Env } from '../../index';
import { sealForWallet } from '../crypto-seal';
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
    nonce,
    walletAddress,
    createdAt: now,
    expiresAt,
    protocols: ALL_SSO_PROTOCOLS,
  };
  await env.IDENTITIES.put(ssoSessionKey(nonce), JSON.stringify(session), {
    expirationTtl: 86400,
  });
  return session;
}

export async function refreshCrossNetworkSession(
  nonce: string,
  env: Env,
): Promise<SSOSession | null> {
  const raw = await env.IDENTITIES.get(ssoSessionKey(nonce));
  if (!raw) return null;
  const session: SSOSession = JSON.parse(raw);
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  await env.IDENTITIES.put(ssoSessionKey(nonce), JSON.stringify(session), {
    expirationTtl: 86400,
  });
  return session;
}

export async function verifySessionToken(token: string, env: Env): Promise<SSOSession | null> {
  const raw = await env.IDENTITIES.get(ssoSessionKey(token));
  if (!raw) return null;
  const session: SSOSession = JSON.parse(raw);
  if (session.expiresAt < Date.now()) return null;
  const revoked = await env.IDENTITIES.get(ssoRevokedKey(token));
  if (revoked) return null;
  return session;
}

export async function signSessionToken(session: SSOSession): Promise<string> {
  // In production, use a proper JWT or similar
  return session.nonce;
}

export async function revokeSession(nonce: string, env: Env): Promise<boolean> {
  await env.IDENTITIES.put(ssoRevokedKey(nonce), '1', { expirationTtl: 86400 * 7 });
  return true;
}

export async function revokeAllSessions(walletAddress: string, env: Env): Promise<number> {
  // For now, we revoke the current sessions by listing from KV
  let count = 0;
  const list = await env.IDENTITIES.list({ prefix: `session:` });
  for (const key of list.keys) {
    const raw = await env.IDENTITIES.get(key.name);
    if (raw) {
      const session: SSOSession = JSON.parse(raw);
      if (session.walletAddress === walletAddress) {
        await revokeSession(session.nonce, env);
        count++;
      }
    }
  }
  return count;
}

export async function isSessionRevoked(nonce: string, env: Env): Promise<boolean> {
  const revoked = await env.IDENTITIES.get(ssoRevokedKey(nonce));
  return revoked !== null;
}

// ─── Wallet State ──────────────────────────────────────────────────────

export async function getOrInitWalletState(
  walletAddress: string,
  env: Env,
): Promise<SSOWalletState> {
  const raw = await env.IDENTITIES.get(ssoWalletStateKey(walletAddress));
  if (raw) return JSON.parse(raw);
  const state: SSOWalletState = {
    walletAddress,
    accounts: {},
    lastActive: Date.now(),
    createdAt: Date.now(),
  };
  await env.IDENTITIES.put(ssoWalletStateKey(walletAddress), JSON.stringify(state));
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
    const existingAccount = state.accounts[protocolId];
    if (existingAccount && existingAccount.status === 'active') {
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
        state.accounts[protocolId] = {
          protocol: protocolId,
          registered: registration.status === 'created',
          username: registration.username || username,
          profileUrl: registration.accountInfo?.profileUrl || null,
          lastActive: Date.now(),
          createdAt: Date.now(),
        } as SSOAccountState;

        console.log(
          `[sso-bridge] Provisioned ${protocolId} for ${walletAddress.slice(0, 8)} as ${registration.username}`,
        );
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
  await env.IDENTITIES.put(ssoWalletStateKey(walletAddress), JSON.stringify(state));

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
): Promise<{ ok: boolean; username?: string; error?: string }> {
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
      state.accounts[protocolId] = {
        protocol: protocolId,
        registered: registration.status === 'created',
        username: registration.username || username,
        profileUrl: registration.accountInfo?.profileUrl || null,
        lastActive: Date.now(),
        createdAt: Date.now(),
      } as SSOAccountState;
      await env.IDENTITIES.put(ssoWalletStateKey(walletAddress), JSON.stringify(state));

      console.log(
        `[sso-bridge] Provisioned single ${protocolId} for ${walletAddress.slice(0, 8)} as ${registration.username}`,
      );

      return {
        ok: true,
        username: registration.username,
        error: registration.status === 'pending' ? registration.error : undefined,
      };
    }

    return {
      ok: false,
      error: registration.error || 'Registration returned failed status',
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
  const raw = await env.IDENTITIES.get(ssoExportKey(walletAddress));
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function importIdentityBundle(
  walletAddress: string,
  bundle: SSOExportBundle,
  env: Env,
): Promise<boolean> {
  await env.IDENTITIES.put(ssoExportKey(walletAddress), JSON.stringify(bundle));
  return true;
}

// ─── Recovery ──────────────────────────────────────────────────────────

export async function generateRecoveryCode(walletAddress: string, env: Env): Promise<string> {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await env.IDENTITIES.put(`recovery:${code}`, walletAddress, { expirationTtl: 86400 * 7 });
  return code;
}

export async function recoverWithCode(code: string, env: Env): Promise<string | null> {
  return env.IDENTITIES.get(`recovery:${code}`);
}

// ─── Activity ──────────────────────────────────────────────────────────

export async function getActivityFeed(
  walletAddress: string,
  env: Env,
  limit = 50,
): Promise<Array<{ type: string; protocol: string; timestamp: number; data: string }>> {
  const raw = await env.IDENTITIES.get(ssoActivityFeedKey(walletAddress));
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
  const raw = await env.IDENTITIES.get(ssoActivityFeedKey(walletAddress));
  const activities = raw ? JSON.parse(raw) : [];
  activities.unshift({ type, protocol, timestamp: Date.now(), data });
  if (activities.length > 200) activities.length = 200;
  await env.IDENTITIES.put(ssoActivityFeedKey(walletAddress), JSON.stringify(activities));
}

export async function getLastActive(walletAddress: string, env: Env): Promise<number | null> {
  const raw = await env.IDENTITIES.get(ssoLastActiveKey(walletAddress));
  return raw ? parseInt(raw, 10) : null;
}

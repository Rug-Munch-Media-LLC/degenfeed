/**
 * @degenfeed/identity — Bring Your Own Account verification
 *
 * Verifies an existing external identity so it can be linked to a DegenFeed
 * profile. Supports two classes of input:
 *
 *   1. BYOA protocols (Nostr, Farcaster, Lens, Bluesky, Mastodon) where the
 *      identity is verified against a public endpoint (NIP-05, Farcaster hub,
 *      Lens API, AT Protocol DID resolution, ActivityPub WebFinger).
 *   2. External platforms (X/Twitter, YouTube, GitHub, Discord, Telegram)
 *      where verification is format/URL-based (no API key required).
 *
 * Every function is pure and accepts an optional fetchFn for testing.
 * Verification never stores credentials — it returns public identifiers only.
 */

import type { Protocol } from '@degenfeed/types';
import { EXTERNAL_PLATFORMS, type ExternalPlatformId, extractHandleFromUrl } from './platforms';

/** How the identity was verified */
export type VerificationMethod =
  | 'nip05'
  | 'npub-decode'
  | 'fid'
  | 'lens-api'
  | 'did'
  | 'webfinger'
  | 'url-format';

export interface VerifiedIdentity {
  /** Protocol id stored on the identity record */
  protocol: Protocol;
  /** Canonical identifier (pubkey hex, DID, FID string, acct, username) */
  identifier: string;
  /** Display handle (npub, @user, user@instance, @channel, ...) */
  handle: string;
  /** Optional display name when resolvable */
  displayName?: string;
  /** Optional avatar URL when resolvable */
  avatarUrl?: string;
  /** How the identity was verified */
  verification: VerificationMethod;
  /** Canonical profile URL when applicable */
  profileUrl?: string;
}

export interface NostrVerifyInput {
  /** Bare Nostr pubkey in hex, or npub bech32, or NIP-05 identifier */
  input: string;
  /** Optional NIP-05 identifier to verify ownership against the npub */
  nip05?: string;
}

// ─── Nostr ──────────────────────────────────────────────────────────────

/**
 * Verify a Nostr identity from an npub/pubkey/NIP-05.
 *
 * - `npub1...` / hex pubkey: decoded/validated locally (no network).
 * - `user@domain` (NIP-05): resolved against the domain well-known file.
 * - Optional `nip05` cross-check: verifies the NIP-05 maps back to the pubkey.
 */
export async function verifyNostrIdentity(
  input: NostrVerifyInput,
  fetchFn: typeof fetch = fetch,
): Promise<VerifiedIdentity | null> {
  const raw = input.input.trim().toLowerCase();
  let pubkeyHex: string | null = null;
  let handle = raw;
  let method: VerificationMethod = 'npub-decode';

  // 1. Hex pubkey (64 chars) — accept directly
  if (/^[0-9a-f]{64}$/.test(raw)) {
    pubkeyHex = raw;
  } else if (raw.startsWith('npub1')) {
    // 2. npub bech32 — decode to hex
    try {
      const { npubDecode } = await import('@degenfeed/nostr-sdk');
      pubkeyHex = npubDecode(raw);
      handle = raw;
    } catch {
      return null;
    }
  } else if (raw.includes('@') && !raw.startsWith('@')) {
    // 3. NIP-05 identifier — resolve to pubkey
    try {
      const { resolveNip05 } = await import('@degenfeed/nostr-sdk');
      const result = await resolveNip05(raw, fetchFn);
      if (!result) return null;
      pubkeyHex = result.pubkey;
      handle = raw;
      method = 'nip05';
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (!pubkeyHex) return null;

  // 4. Optional NIP-05 ownership cross-check
  if (input.nip05) {
    try {
      const { verifyNip05 } = await import('@degenfeed/nostr-sdk');
      const ok = await verifyNip05(input.nip05, pubkeyHex, fetchFn);
      if (!ok) return null;
      handle = input.nip05;
      method = 'nip05';
    } catch {
      return null;
    }
  }

  return {
    protocol: 'nostr',
    identifier: pubkeyHex,
    handle,
    verification: method,
  };
}

// ─── Bluesky ────────────────────────────────────────────────────────────

/**
 * Verify a Bluesky identity from a handle (alice.bsky.social) or DID.
 * Resolves the handle to its DID via the public AT Protocol API.
 */
export async function verifyBlueskyIdentity(
  input: string,
  fetchFn: typeof fetch = fetch,
): Promise<VerifiedIdentity | null> {
  const raw = input.trim();

  // DID input — verify the DID document exists
  if (raw.startsWith('did:')) {
    try {
      const res = await fetchFn(`https://plc.directory/${encodeURIComponent(raw)}/data`);
      if (!res.ok) return null;
      return {
        protocol: 'bluesky',
        identifier: raw,
        handle: `@${raw}`,
        verification: 'did',
      };
    } catch {
      return null;
    }
  }

  if (!raw.includes('.') || raw.includes('@')) return null;

  try {
    const res = await fetchFn(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(raw)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { did: string };
    if (!json.did) return null;

    // Fetch profile metadata (display name + avatar) when available
    let displayName: string | undefined;
    let avatarUrl: string | undefined;
    try {
      const profileRes = await fetchFn(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(json.did)}`,
      );
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as {
          displayName?: string;
          avatar?: string;
        };
        displayName = profile.displayName;
        avatarUrl = profile.avatar;
      }
    } catch {
      // Non-fatal
    }

    return {
      protocol: 'bluesky',
      identifier: json.did,
      handle: `@${raw}`,
      displayName,
      avatarUrl,
      verification: 'did',
    };
  } catch {
    return null;
  }
}

// ─── Farcaster ──────────────────────────────────────────────────────────

/**
 * Verify a Farcaster identity from an FID (number) or username.
 * Resolves via a public Farcaster hub.
 */
export async function verifyFarcasterIdentity(
  input: string,
  fetchFn: typeof fetch = fetch,
): Promise<VerifiedIdentity | null> {
  const raw = input.trim().replace(/^@/, '');
  const hub = 'https://hub.farcaster.standardcrypto.vc:2281';

  if (/^\d+$/.test(raw)) {
    try {
      const res = await fetchFn(`${hub}/v1/userDataByFid?fid=${Number.parseInt(raw, 10)}`);
      if (!res.ok) return null;
      return {
        protocol: 'farcaster',
        identifier: raw,
        handle: `@${raw}`,
        verification: 'fid',
      };
    } catch {
      return null;
    }
  }

  if (!/^[a-z0-9_.-]+$/i.test(raw)) return null;

  try {
    const res = await fetchFn(`${hub}/v1/userDataByUsername?username=${encodeURIComponent(raw)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { fid?: number };
    if (json.fid == null) return null;
    return {
      protocol: 'farcaster',
      identifier: String(json.fid),
      handle: `@${raw}`,
      verification: 'fid',
    };
  } catch {
    return null;
  }
}

// ─── Lens ───────────────────────────────────────────────────────────────

/**
 * Verify a Lens identity from a handle (e.g. "stani.lens").
 * Resolves via the Lens API GraphQL endpoint.
 */
export async function verifyLensIdentity(
  input: string,
  fetchFn: typeof fetch = fetch,
): Promise<VerifiedIdentity | null> {
  const raw = input
    .trim()
    .replace(/^@/, '')
    .replace(/^lens\//, '');
  if (!raw) return null;

  try {
    const res = await fetchFn('https://api.lens.xyz/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query { profile(request: { handle: "${raw}" }) { id handle } }`,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { profile?: { id: string; handle: string } | null };
    };
    const profile = json.data?.profile;
    if (!profile) return null;
    return {
      protocol: 'lens',
      identifier: profile.id,
      handle: `lens/${profile.handle}`,
      verification: 'lens-api',
    };
  } catch {
    return null;
  }
}

// ─── Fediverse / Mastodon ───────────────────────────────────────────────

/**
 * Verify a fediverse identity from a `user@instance` handle via WebFinger.
 * Returns the canonical ActivityPub account handle.
 */
export async function verifyFediverseIdentity(
  input: string,
  fetchFn: typeof fetch = fetch,
): Promise<VerifiedIdentity | null> {
  const raw = input.trim().toLowerCase();
  const atIndex = raw.indexOf('@');
  if (atIndex <= 0 || atIndex === raw.length - 1) return null;
  const domain = raw.slice(atIndex + 1);

  try {
    const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=acct:${encodeURIComponent(raw)}`;
    const res = await fetchFn(webfingerUrl);
    if (!res.ok) return null;
    const json = (await res.json()) as { links?: { rel: string; href: string }[] };
    const selfLink = json.links?.find((l) => l.rel === 'self');
    if (!selfLink) return null;

    // Prefer the canonical acct from the subject when available
    const subject = (json as { subject?: string }).subject;
    const canonical = subject?.startsWith('acct:') ? subject.slice(5) : raw;

    return {
      protocol: 'mastodon',
      identifier: selfLink.href,
      handle: canonical,
      verification: 'webfinger',
    };
  } catch {
    return null;
  }
}

// ─── External platforms (format-based) ──────────────────────────────────

const EXTERNAL_VALIDATORS: Record<ExternalPlatformId, (handle: string) => boolean> = {
  twitter: (h) => /^[a-zA-Z0-9_]{1,15}$/.test(h),
  youtube: (h) => /^[a-zA-Z0-9_.-]{3,64}$/.test(h),
  github: (h) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(h),
  discord: (h) => /^.{2,32}#\d{4}$/.test(h) || /^\d{17,20}$/.test(h),
  telegram: (h) => /^[a-zA-Z0-9_]{5,32}$/.test(h),
};

/**
 * Verify an external platform handle (X, YouTube, GitHub, Discord, Telegram).
 * Format-based — extracts the bare handle from a URL when one is given.
 */
export function verifyExternalIdentity(
  protocol: ExternalPlatformId,
  input: string,
): VerifiedIdentity | null {
  const meta = EXTERNAL_PLATFORMS[protocol];
  if (!meta) return null;

  const handle = extractHandleFromUrl(protocol, input);
  if (!handle) return null;

  const validator = EXTERNAL_VALIDATORS[protocol];
  if (!validator(handle)) return null;

  return {
    protocol: protocol as Protocol,
    identifier: handle.toLowerCase(),
    handle,
    verification: 'url-format',
    profileUrl: meta.profileUrl?.(handle),
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────

export interface VerifyIdentityOptions {
  /** Only used for Nostr: optional NIP-05 identifier to cross-check */
  nip05?: string;
  fetchFn?: typeof fetch;
}

/**
 * Verify any supported identity input and return canonical data.
 * Returns null when the input cannot be verified.
 */
export async function verifyIdentity(
  protocol: string,
  input: string,
  options: VerifyIdentityOptions = {},
): Promise<VerifiedIdentity | null> {
  const fetchFn = options.fetchFn ?? fetch;

  switch (protocol) {
    case 'nostr':
      return verifyNostrIdentity({ input, nip05: options.nip05 }, fetchFn);
    case 'bluesky':
      return verifyBlueskyIdentity(input, fetchFn);
    case 'farcaster':
      return verifyFarcasterIdentity(input, fetchFn);
    case 'lens':
      return verifyLensIdentity(input, fetchFn);
    case 'mastodon':
      return verifyFediverseIdentity(input, fetchFn);
    case 'twitter':
    case 'youtube':
    case 'github':
    case 'discord':
    case 'telegram':
      return verifyExternalIdentity(protocol as ExternalPlatformId, input);
    default:
      return null;
  }
}

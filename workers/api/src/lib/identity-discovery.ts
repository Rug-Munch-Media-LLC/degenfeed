/**
 * @degenfeed/api-worker — Identity Discovery Service
 *
 * Given a wallet address or existing identity, discovers ALL linked
 * protocol identities across the decentralized web.
 *
 * Discovery methods:
 *   1. ENS reverse resolution → text records
 *   2. Farcaster verified address matching
 *   3. Lens API profile lookup
 *   4. Nostr relay search (kind 0 profiles)
 *   5. Bluesky PLC DID resolution
 *   6. Cross-reference chaining
 *
 * Results are cached for 1 hour (identity:discovery:{wallet}).
 * Last discovery timestamp stored at: identity:discovery:ts:{wallet}
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import type { Env } from '../types';
import { getIdentity, setIdentity } from './rmi-client';

// ─── Types ──────────────────────────────────────────────────────────────

export interface DiscoveredIdentity {
  protocol: string;
  identity: Record<string, unknown>;
  /** 'verified' = cryptographically proven, 'inferred' = found via cross-ref */
  confidence: 'verified' | 'inferred';
  /** The discovery method that found this */
  method: string;
  /** Display label for the identity */
  label: string;
}

export interface DiscoveryResult {
  discovered: DiscoveredIdentity[];
  alreadyLinked: string[];
  walletAddress: string;
  scannedProtocols: string[];
  scanDurationMs: number;
}

export interface DiscoveryProgress {
  status: 'scanning' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  discovered: DiscoveredIdentity[];
  totalProtocols: number;
}

// ─── KV key helpers ────────────────────────────────────────────────────

function discoveryCacheKey(wallet: string): string {
  return `identity:discovery:${wallet.toLowerCase()}`;
}

function discoveryTimestampKey(wallet: string): string {
  return `identity:discovery:ts:${wallet.toLowerCase()}`;
}

export function getDiscoveryTimestampKey(wallet: string): string {
  return discoveryTimestampKey(wallet);
}

// ─── Constants ─────────────────────────────────────────────────────────

const DISCOVERY_CACHE_TTL = 3600; // 1 hour
const DISCOVERY_PROTOCOLS = [
  'farcaster',
  'lens',
  'nostr',
  'bluesky',
  'mastodon',
  'ens',
  'telegram',
  'reddit',
];

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
];

const FARCASTER_HUBS = [
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
];

const LENS_API = 'https://api.lens.xyz/graphql';
const BSKY_PUBLIC_API = 'https://public.api.bsky.app';
const PLC_DIRECTORY = 'https://plc.directory';

// ─── Main Discovery Function ──────────────────────────────────────────

/**
 * Discover all protocol identities linked to a wallet address.
 * Checks cache first, only does full scan if cache is stale/missing.
 */
export async function discoverIdentities(
  walletAddress: string,
  env: Env,
  options?: { forceRefresh?: boolean; onProgress?: (p: DiscoveryProgress) => void },
): Promise<DiscoveryResult> {
  const wallet = walletAddress.toLowerCase();
  const startTime = Date.now();

  // Check cache unless forced refresh
  if (!options?.forceRefresh) {
    try {
      const cached = await env.CACHE?.get(discoveryCacheKey(wallet));
      if (cached) {
        const parsed = JSON.parse(cached) as DiscoveryResult;
        // Only use cache if it has results
        if (parsed.discovered.length > 0 || parsed.alreadyLinked.length > 0) {
          return parsed;
        }
      }
    } catch {
      // cache miss — proceed with scan
    }
  }

  // Fetch existing linked identities — rmi-backend first, KV as fallback
  const alreadyLinked: string[] = [];
  let existingIdentity: Record<string, unknown> | null = null;
  try {
    existingIdentity = await getIdentity(env, wallet);
  } catch {
    existingIdentity = null;
  }
  if (!existingIdentity && env.IDENTITIES) {
    try {
      const raw = await env.IDENTITIES.get(identityKey(wallet));
      if (raw) existingIdentity = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // no existing record
    }
  }
  if (existingIdentity) {
    for (const key of Object.keys(existingIdentity)) {
      if (key !== 'walletAddress' && key !== 'linkedAt' && key !== 'lastVerified') {
        alreadyLinked.push(key);
      }
    }
  }

  const discovered: DiscoveredIdentity[] = [];
  const totalProtocols = DISCOVERY_PROTOCOLS.length;
  let completed = 0;

  const reportProgress = (message: string) => {
    completed++;
    const progress = Math.round((completed / totalProtocols) * 100);
    options?.onProgress?.({
      status: 'scanning',
      progress,
      message,
      discovered: [...discovered],
      totalProtocols,
    });
  };

  // ─── Method 1: ENS Reverse Resolution ────────────────────────────────
  reportProgress('Scanning ENS for linked identities...');
  const ensIdentities = await discoverFromEns(wallet, env);
  for (const id of ensIdentities) {
    if (!alreadyLinked.includes(id.protocol) && !isAlreadyDiscovered(discovered, id.protocol)) {
      discovered.push(id);
    }
  }

  // ─── Method 2: Farcaster ─────────────────────────────────────────────
  reportProgress('Checking Farcaster for verified wallet...');
  const fcIdentities = await discoverFromFarcaster(wallet, env);
  for (const id of fcIdentities) {
    if (!alreadyLinked.includes(id.protocol) && !isAlreadyDiscovered(discovered, id.protocol)) {
      discovered.push(id);
    }
  }

  // ─── Method 3: Lens Protocol ──────────────────────────────────────────
  reportProgress('Searching Lens Protocol for your profile...');
  const lensIdentities = await discoverFromLens(wallet, env);
  for (const id of lensIdentities) {
    if (!alreadyLinked.includes(id.protocol) && !isAlreadyDiscovered(discovered, id.protocol)) {
      discovered.push(id);
    }
  }

  // ─── Method 4: Nostr ──────────────────────────────────────────────────
  reportProgress('Scanning Nostr relays for your identity...');
  const nostrIdentities = await discoverFromNostr(wallet, env);
  for (const id of nostrIdentities) {
    if (!alreadyLinked.includes(id.protocol) && !isAlreadyDiscovered(discovered, id.protocol)) {
      discovered.push(id);
    }
  }

  // ─── Method 5: Bluesky / AT Protocol ─────────────────────────────────
  reportProgress('Checking Bluesky for your account...');
  const bskyIdentities = await discoverFromBluesky(wallet, env);
  for (const id of bskyIdentities) {
    if (!alreadyLinked.includes(id.protocol) && !isAlreadyDiscovered(discovered, id.protocol)) {
      discovered.push(id);
    }
  }

  // ─── Method 6: Cross-Reference Chaining ───────────────────────────────
  // Once we have any identity, use it to find others via cross-ref
  if (discovered.length > 0) {
    reportProgress('Cross-referencing identities across protocols...');
    const crossRefIdentities = await discoverCrossReference(discovered, wallet, env);
    for (const id of crossRefIdentities) {
      if (!alreadyLinked.includes(id.protocol) && !isAlreadyDiscovered(discovered, id.protocol)) {
        discovered.push(id);
      }
    }
  }

  const result: DiscoveryResult = {
    discovered,
    alreadyLinked,
    walletAddress: wallet,
    scannedProtocols: DISCOVERY_PROTOCOLS,
    scanDurationMs: Date.now() - startTime,
  };

  // Cache for 1 hour
  try {
    await env.CACHE?.put(discoveryCacheKey(wallet), JSON.stringify(result), {
      expirationTtl: DISCOVERY_CACHE_TTL,
    });
    // Update last discovery timestamp
    await env.CACHE?.put(discoveryTimestampKey(wallet), String(Date.now()));
  } catch {
    // non-fatal
  }

  return result;
}

// ─── Method 1: ENS Reverse Resolution ──────────────────────────────────

async function discoverFromEns(wallet: string, _env: Env): Promise<DiscoveredIdentity[]> {
  const results: DiscoveredIdentity[] = [];

  // Only works for EVM addresses
  if (!wallet.startsWith('0x')) return results;

  try {
    // Try mainnet ENS via eth.blockscout.com or similar public resolver
    // Use the ethers.js-inspired approach: resolve reverse record
    const ensResolverUrl = `https://api.ensideas.com/ens/resolve/${wallet}`;
    const resp = await fetch(ensResolverUrl);
    if (!resp.ok) return results;

    const data = (await resp.json()) as {
      name?: string;
      avatar?: string;
      display?: string;
      records?: Record<string, string>;
    };

    if (data.name) {
      results.push({
        protocol: 'ens',
        identity: {
          name: data.name,
          avatar: data.avatar || null,
          display: data.display || data.name,
        },
        confidence: 'verified',
        method: 'ens_reverse_resolve',
        label: data.name,
      });
    }

    // Extract protocol identities from ENS text records
    // ENS text records often contain social links
    if (data.records) {
      // Twitter/X
      if (data.records.com_twitter || data.records['com.twitter']) {
        const tw = data.records.com_twitter || data.records['com.twitter'];
        results.push({
          protocol: 'twitter',
          identity: { username: tw },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: `@${tw}`,
        });
      }

      // GitHub
      if (data.records.com_github || data.records['com.github']) {
        const gh = data.records.com_github || data.records['com.github'];
        results.push({
          protocol: 'github',
          identity: { username: gh },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: `@${gh}`,
        });
      }

      // Telegram
      if (data.records.org_telegram || data.records['org.telegram']) {
        const tg = data.records.org_telegram || data.records['org.telegram'];
        results.push({
          protocol: 'telegram',
          identity: { username: tg },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: `@${tg}`,
        });
      }

      // Farcaster
      if (data.records.social_farcaster || data.records['social.farcaster']) {
        const fc = data.records.social_farcaster || data.records['social.farcaster'];
        results.push({
          protocol: 'farcaster',
          identity: { username: fc, fid: 0 },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: `@${fc}`,
        });
      }

      // Lens
      if (data.records.social_lens || data.records['social.lens']) {
        const lens = data.records.social_lens || data.records['social.lens'];
        results.push({
          protocol: 'lens',
          identity: { handle: lens },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: `lens/${lens}`,
        });
      }

      // Nostr (NIP-05)
      if (data.records.org_nostr || data.records['org.nostr']) {
        const nip05 = data.records.org_nostr || data.records['org.nostr'];
        results.push({
          protocol: 'nostr',
          identity: { nip05 },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: nip05,
        });
      }

      // Bluesky
      if (data.records.vnd_bluesky || data.records['vnd.bluesky']) {
        const bsky = data.records.vnd_bluesky || data.records['vnd.bluesky'];
        results.push({
          protocol: 'bluesky',
          identity: { did: bsky },
          confidence: 'inferred',
          method: 'ens_text_record',
          label: bsky,
        });
      }
    }
  } catch {
    // ENS resolver unavailable — non-fatal
  }

  return results;
}

// ─── Method 2: Farcaster ───────────────────────────────────────────────

async function discoverFromFarcaster(wallet: string, _env: Env): Promise<DiscoveredIdentity[]> {
  const results: DiscoveredIdentity[] = [];

  // Validate wallet format
  if (!wallet.startsWith('0x') && !wallet.startsWith('0x')) return results;

  for (const hub of FARCASTER_HUBS) {
    try {
      // Try to find verified addresses matching this wallet
      const resp = await fetch(`${hub}/v1/verificationsByAddress?address=${wallet.toLowerCase()}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) continue;

      const data = (await resp.json()) as {
        messages?: Array<{
          data?: { fid?: number };
        }>;
      };

      if (data.messages && data.messages.length > 0) {
        const fid = data.messages[0]?.data?.fid;
        if (!fid) continue;

        // Get username from FID
        const userResp = await fetch(`${hub}/v1/userDataByFid?fid=${fid}`, {
          signal: AbortSignal.timeout(5000),
        });

        if (userResp.ok) {
          const userData = (await userResp.json()) as {
            messages?: Array<{
              data?: { userDataBody?: { type?: string; value?: string } };
            }>;
          };

          let username = `fid:${fid}`;
          if (userData.messages) {
            for (const msg of userData.messages) {
              if (msg.data?.userDataBody?.type === 'USER_DATA_TYPE_USERNAME') {
                username = msg.data.userDataBody.value || username;
                break;
              }
            }
          }

          results.push({
            protocol: 'farcaster',
            identity: {
              fid,
              username,
              custodyAddress: wallet,
              verified: true,
            },
            confidence: 'verified',
            method: 'farcaster_verification',
            label: `@${username} (FID ${fid})`,
          });
        }

        break; // Found on first hub, no need to try others
      }
    } catch {
      // Try next hub
    }
  }

  return results;
}

// ─── Method 3: Lens Protocol ───────────────────────────────────────────

async function discoverFromLens(wallet: string, _env: Env): Promise<DiscoveredIdentity[]> {
  const results: DiscoveredIdentity[] = [];

  if (!wallet.startsWith('0x')) return results;

  try {
    // Query Lens API for profiles owned by this wallet
    const gqlQuery = {
      query: `
        query DefaultProfile($address: EthereumAddress!) {
          defaultProfile(request: { ethereumAddress: $address }) {
            id
            handle
            name
            bio
            picture {
              ... on MediaSet {
                original {
                  url
                }
              }
            }
            stats {
              totalFollowers
              totalFollowing
            }
          }
          profiles(request: { ownedBy: [$address], limit: 5 }) {
            items {
              id
              handle
              name
              bio
            }
          }
        }
      `,
      variables: { address: wallet },
    };

    const resp = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(gqlQuery),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return results;

    const data = (await resp.json()) as {
      data?: {
        defaultProfile?: { id: string; handle: string; name?: string };
        profiles?: { items: Array<{ id: string; handle: string; name?: string }> };
      };
    };

    const defaultProfile = data?.data?.defaultProfile;
    const profiles = data?.data?.profiles?.items || [];

    // Add default profile
    if (defaultProfile) {
      results.push({
        protocol: 'lens',
        identity: {
          profileId: defaultProfile.id,
          handle: defaultProfile.handle,
          name: defaultProfile.name || defaultProfile.handle,
          isDefault: true,
          verified: true,
        },
        confidence: 'verified',
        method: 'lens_api',
        label: defaultProfile.handle,
      });
    }

    // Add additional profiles (non-default)
    for (const profile of profiles) {
      if (defaultProfile && profile.id === defaultProfile.id) continue;
      if (profile.handle) {
        results.push({
          protocol: 'lens',
          identity: {
            profileId: profile.id,
            handle: profile.handle,
            name: profile.name || profile.handle,
            isDefault: false,
            verified: true,
          },
          confidence: 'verified',
          method: 'lens_api',
          label: profile.handle,
        });
      }
    }
  } catch {
    // Lens API unavailable
  }

  return results;
}

// ─── Method 4: Nostr ──────────────────────────────────────────────────

async function discoverFromNostr(wallet: string, _env: Env): Promise<DiscoveredIdentity[]> {
  const results: DiscoveredIdentity[] = [];

  // Nostr discovery via NIP-05: check if wallet has a known NIP-05 identifier
  // Since we can't query relays directly from the worker easily,
  // we use public indexers and NIP-05 resolution

  // Try NIP-05 resolution via the damus relay or similar public API
  try {
    // Query nostr.band API for profiles with lightning address or NIP-05
    // matching this wallet's address pattern
    const nip05Candidates = [
      `${wallet.slice(2, 10)}.nip05.social`,
      `${wallet.slice(2, 10)}.nostr.xyz`,
    ];

    for (const nip05 of nip05Candidates) {
      try {
        const resp = await fetch(
          `https://api.nostr.band/.well-known/nostr.json?name=${encodeURIComponent(nip05)}`,
          { signal: AbortSignal.timeout(5000) },
        );

        if (resp.ok) {
          const data = (await resp.json()) as { names?: Record<string, string> };
          if (data.names && Object.keys(data.names).length > 0) {
            for (const [name, pubkey] of Object.entries(data.names)) {
              results.push({
                protocol: 'nostr',
                identity: {
                  nip05: `${name}@${nip05}`,
                  pubkey,
                },
                confidence: 'inferred',
                method: 'nostr_nip05',
                label: `${name}@${nip05}`,
              });
            }
          }
        }
      } catch {
        // try next candidate
      }
    }

    // Try searching for profiles that contain wallet addresses
    // Using a nostr.band search is more likely to find matches
    try {
      const searchResp = await fetch(
        `https://api.nostr.band/v0/profiles?q=${wallet.slice(2, 12)}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (searchResp.ok) {
        const searchData = (await searchResp.json()) as {
          profiles?: Array<{
            pubkey: string;
            profile?: {
              name?: string;
              display_name?: string;
              nip05?: string;
              lud16?: string;
              lud06?: string;
              about?: string;
            };
          }>;
        };

        if (searchData.profiles) {
          for (const profile of searchData.profiles) {
            if (profile.profile?.name || profile.profile?.display_name) {
              const name = profile.profile.display_name || profile.profile.name || '';
              const npub = profile.pubkey;
              results.push({
                protocol: 'nostr',
                identity: {
                  pubkey: npub,
                  name,
                  nip05: profile.profile.nip05 || null,
                  lightning: profile.profile.lud16 || profile.profile.lud06 || null,
                },
                confidence: 'inferred',
                method: 'nostr_profile_search',
                label: `@${name}`,
              });
            }
          }
        }
      }
    } catch {
      // search endpoint unavailable
    }
  } catch {
    // Nostr discovery failed — non-fatal
  }

  return results;
}

// ─── Method 5: Bluesky / AT Protocol ──────────────────────────────────

async function discoverFromBluesky(wallet: string, _env: Env): Promise<DiscoveredIdentity[]> {
  const results: DiscoveredIdentity[] = [];

  try {
    // Check if this wallet has a known Bluesky DID
    // Use PLC directory to search for DID documents that reference this wallet
    // We do a reverse lookup: scan recent DID documents for matching wallet

    // First, try the public Bluesky API to resolve any known handle
    // that might match the wallet (brute force is not ideal but useful)

    // The most reliable method: some projects index wallet→DID mappings
    // Check our own KV for linked Bluesky identities
    // (This is handled by the cross-reference method below)

    // Try to resolve via known patterns (wallet-based handles on Bluesky PDS)
    const handleCandidates = [
      `${wallet.slice(2, 8)}.bsky.social`,
      `${wallet.slice(2, 10)}.pds.degenfeed.xyz`,
    ];

    for (const handle of handleCandidates) {
      try {
        const resolveResp = await fetch(
          `${BSKY_PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
          { signal: AbortSignal.timeout(5000) },
        );

        if (resolveResp.ok) {
          const resolved = (await resolveResp.json()) as { did: string };
          results.push({
            protocol: 'bluesky',
            identity: { did: resolved.did, handle },
            confidence: 'inferred',
            method: 'bluesky_handle_guess',
            label: `@${handle}`,
          });
          break;
        }
      } catch {
        // try next candidate
      }
    }

    // Check PLC directory via DID document queries
    // This works if we have a DID to query (found from another method)
    // Cross-reference will handle this
  } catch {
    // Bluesky discovery failed
  }

  return results;
}

// ─── Method 6: Cross-Reference Chaining ───────────────────────────────

async function discoverCrossReference(
  existing: DiscoveredIdentity[],
  wallet: string,
  _env: Env,
): Promise<DiscoveredIdentity[]> {
  const results: DiscoveredIdentity[] = [];
  const seenProtocols = new Set(existing.map((d) => d.protocol));

  // Extract all discovered handles and IDs for cross-referencing
  const farcaster = existing.find((d) => d.protocol === 'farcaster');
  const lens = existing.find((d) => d.protocol === 'lens');
  const bsky = existing.find((d) => d.protocol === 'bluesky');
  const _nostr = existing.find((d) => d.protocol === 'nostr');
  const ens = existing.find((d) => d.protocol === 'ens');

  // ── If we have Farcaster, try to find their other identities ──
  if (farcaster && !seenProtocols.has('bluesky')) {
    // Farcaster users often link their Bluesky in their bio
    const fid = farcaster.identity.fid as number;
    if (fid) {
      try {
        const userDataResp = await fetch(`${FARCASTER_HUBS[0]}/v1/userDataByFid?fid=${fid}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (userDataResp.ok) {
          const userData = (await userDataResp.json()) as {
            messages?: Array<{
              data?: { userDataBody?: { type?: string; value?: string } };
            }>;
          };
          if (userData.messages) {
            let bio = '';
            let _displayName = '';

            for (const msg of userData.messages) {
              const type = msg.data?.userDataBody?.type;
              const value = msg.data?.userDataBody?.value;
              if (type === 'USER_DATA_TYPE_BIO') bio = value || '';
              if (type === 'USER_DATA_TYPE_DISPLAY') _displayName = value || '';
            }

            // Check bio for Bluesky handle
            const bskyMatch = bio.match(/(?:bsky\.social|bluesky)\/profile\/([a-zA-Z0-9_.-]+)/i);
            if (bskyMatch?.[1] && !seenProtocols.has('bluesky')) {
              try {
                const resolveResp = await fetch(
                  `${BSKY_PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(bskyMatch[1])}`,
                  { signal: AbortSignal.timeout(5000) },
                );
                if (resolveResp.ok) {
                  const resolved = (await resolveResp.json()) as { did: string };
                  results.push({
                    protocol: 'bluesky',
                    identity: { did: resolved.did, handle: bskyMatch[1] },
                    confidence: 'inferred',
                    method: 'crossref_farcaster_bio',
                    label: `@${bskyMatch[1]}`,
                  });
                  seenProtocols.add('bluesky');
                }
              } catch {
                // ignore
              }
            }

            // Check bio for Nostr npub
            const nostrMatch = bio.match(/npub1[a-zA-Z0-9]{58,60}/);
            if (nostrMatch && !seenProtocols.has('nostr')) {
              results.push({
                protocol: 'nostr',
                identity: { npub: nostrMatch[0] },
                confidence: 'inferred',
                method: 'crossref_farcaster_bio',
                label: `${nostrMatch[0].slice(0, 16)}...`,
              });
              seenProtocols.add('nostr');
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // ── If we have Lens, try to find other identities ──
  if (lens && !seenProtocols.has('bluesky')) {
    // Lens profiles often link Twitter/X handles
    // We can use Lens API to get profile metadata
    const lensHandle = lens.identity.handle as string;
    if (lensHandle) {
      try {
        const metaQuery = {
          query: `
            query ProfileStats($handle: Handle!) {
              profile(request: { handle: $handle }) {
                metadata
                twitterUrl
              }
            }
          `,
          variables: { handle: lensHandle },
        };

        const resp = await fetch(LENS_API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(metaQuery),
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const data = (await resp.json()) as {
            data?: {
              profile?: {
                metadata?: Record<string, unknown>;
                twitterUrl?: string;
              };
            };
          };

          if (data.data?.profile?.twitterUrl && !seenProtocols.has('twitter')) {
            const twitterUrl = data.data.profile.twitterUrl;
            const username = twitterUrl.split('/').pop() || '';
            if (username) {
              results.push({
                protocol: 'twitter',
                identity: { username },
                confidence: 'inferred',
                method: 'crossref_lens_metadata',
                label: `@${username}`,
              });
              seenProtocols.add('twitter');
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // ── If we have ENS, try resolving NIP-05 for Nostr ──
  if (ens && !seenProtocols.has('nostr')) {
    const ensName = ens.identity.name as string;
    if (ensName) {
      // ENS names often double as NIP-05 identifiers
      const nip05 = `${wallet.slice(2, 10)}@ens.xyz`;
      try {
        const { resolveNip05 } = await import('@degenfeed/nostr-sdk').catch(() => null);
        if (resolveNip05) {
          const result = await resolveNip05(nip05);
          if (result?.pubkey) {
            results.push({
              protocol: 'nostr',
              identity: { nip05, pubkey: result.pubkey },
              confidence: 'inferred',
              method: 'crossref_ens_nip05',
              label: nip05,
            });
            seenProtocols.add('nostr');
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // ── If we have Bluesky DID, check for linked Mastodon ──
  if (bsky && !seenProtocols.has('mastodon')) {
    const did = bsky.identity.did as string;
    if (did) {
      try {
        // Fetch DID document from PLC directory
        const docResp = await fetch(`${PLC_DIRECTORY}/${encodeURIComponent(did)}/data`, {
          signal: AbortSignal.timeout(5000),
        });
        if (docResp.ok) {
          const doc = (await docResp.json()) as {
            alsoKnownAs?: string[];
          };

          if (doc.alsoKnownAs) {
            for (const aka of doc.alsoKnownAs) {
              // Check for Mastodon/fediverse handles
              if (aka.includes('@') && !aka.startsWith('at://')) {
                const match = aka.match(/acct:(.+)@(.+)/);
                if (match) {
                  const handle = `${match[1]}@${match[2]}`;
                  results.push({
                    protocol: 'mastodon',
                    identity: { handle: match[1], instance: match[2] },
                    confidence: 'inferred',
                    method: 'crossref_bluesky_did',
                    label: handle,
                  });
                  seenProtocols.add('mastodon');
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function isAlreadyDiscovered(list: DiscoveredIdentity[], protocol: string): boolean {
  return list.some((d) => d.protocol === protocol);
}

// ─── Bulk Link: Link all discovered identities to a wallet ────────────

export async function linkDiscoveredIdentities(
  walletAddress: string,
  discovered: DiscoveredIdentity[],
  env: Env,
): Promise<{ linked: number; identities: CrossProtocolIdentity }> {
  const wallet = walletAddress.toLowerCase();

  // Load existing identity record — rmi-backend first, KV as fallback
  let existing: CrossProtocolIdentity | null = null;
  try {
    const identity = await getIdentity(env, wallet);
    if (identity) existing = identity as unknown as CrossProtocolIdentity;
  } catch {
    // API unavailable — fall through to KV
  }
  if (!existing && env.IDENTITIES) {
    try {
      const raw = await env.IDENTITIES.get(identityKey(wallet));
      if (raw) existing = JSON.parse(raw) as CrossProtocolIdentity;
    } catch {
      // no existing
    }
  }

  const now = Date.now();
  const updated: CrossProtocolIdentity = {
    ...(existing || { walletAddress: wallet, linkedAt: now, lastVerified: now }),
  };

  let linked = 0;

  for (const disc of discovered) {
    const protocol = disc.protocol as keyof CrossProtocolIdentity;

    // Skip protocols that don't have a slot in CrossProtocolIdentity
    const validProtocolFields = [
      'nostr',
      'farcaster',
      'lens',
      'bluesky',
      'mastodon',
      'reddit',
      'threads',
      'lemmy',
      'rss',
      'peertube',
      'atproto',
      'zora',
      'telegram',
    ] as Array<keyof CrossProtocolIdentity>;

    if (!validProtocolFields.includes(protocol)) continue;

    // Skip if already linked
    if (existing && (existing as unknown as Record<string, unknown>)[protocol]) continue;

    // Map discovered identity to CrossProtocolIdentity format
    const mapped = mapToCrossProtocolIdentity(protocol, disc);
    if (mapped) {
      (updated as unknown as Record<string, unknown>)[protocol] = mapped;
      linked++;
    }
  }

  updated.lastVerified = now;

  if (linked > 0) {
    // Primary: persist to rmi-backend. KV mirror stays warm for legacy readers.
    let apiOk = false;
    try {
      await setIdentity(env, wallet, updated as unknown as Record<string, unknown>);
      apiOk = true;
    } catch {
      apiOk = false;
    }
    try {
      await env.IDENTITIES?.put(identityKey(wallet), JSON.stringify(updated));
    } catch (err) {
      if (!apiOk) throw new Error(`Failed to store identities: ${String(err)}`);
    }
  }

  // Clear discovery cache since we've linked them
  try {
    await env.CACHE?.delete(`identity:discovery:${wallet.toLowerCase()}`);
  } catch {
    // non-fatal
  }

  return { linked, identities: updated };
}

// ─── Map discovered identity to CrossProtocolIdentity format ──────────

function mapToCrossProtocolIdentity(
  protocol: string,
  disc: DiscoveredIdentity,
): Record<string, unknown> | null {
  switch (protocol) {
    case 'nostr': {
      const npub = (disc.identity.npub as string) || (disc.identity.pubkey as string) || '';
      const nip05 = disc.identity.nip05 as string | undefined;
      return {
        npub: npub || `npub1${(disc.identity.pubkey || '').slice(0, 8)}...`,
        relays: DEFAULT_RELAYS,
        verified: disc.confidence === 'verified',
        ...(nip05 ? { nip05 } : {}),
        ...(!npub && !nip05 ? { manualLinking: true } : {}),
      };
    }
    case 'farcaster': {
      const fid = disc.identity.fid as number;
      const username = disc.identity.username as string;
      if (!fid || !username) return null;
      return {
        fid,
        username,
        custodyAddress: (disc.identity.custodyAddress as string) || '',
        verified: disc.confidence === 'verified',
      };
    }
    case 'lens': {
      const handle = disc.identity.handle as string;
      const profileId = disc.identity.profileId as string;
      if (!handle && !profileId) return null;
      return {
        profileId: profileId || '',
        handle: handle || '',
        verified: disc.confidence === 'verified',
      };
    }
    case 'bluesky': {
      const did = disc.identity.did as string;
      const handle = disc.identity.handle as string;
      return {
        did: did || '',
        handle: handle || '',
        verified: disc.confidence === 'verified',
      };
    }
    case 'mastodon': {
      const handle = disc.identity.handle as string;
      const instance = disc.identity.instance as string;
      if (!handle) return null;
      return {
        handle,
        instance: instance || 'mastodon.social',
        verified: disc.confidence === 'verified',
      };
    }
    case 'telegram': {
      const username = disc.identity.username as string;
      return {
        userId: username || '',
        username,
        verified: disc.confidence === 'verified',
      };
    }
    case 'reddit': {
      const username = disc.identity.username as string;
      if (!username) return null;
      return {
        username,
        verified: disc.confidence === 'verified',
      };
    }
    default:
      return null;
  }
}

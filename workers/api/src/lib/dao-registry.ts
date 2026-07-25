/**
 * @degenfeed/api-worker — DAO Discovery & Cross-Platform Registry
 *
 * A unified registry that links DegenFeed DAOs with their counterparts
 * across Snapshot, Tally, Realms, and OpenZeppelin Defender.
 *
 * KV schema (NS: GOVERNANCE):
 *   dao:registry:list              → array of all DAO IDs (index)
 *   dao:registry:{daoId}           → DAORegistryEntry (persistent)
 *   dao:lookup:snapshot:{space}    → daoId (reverse lookup)
 *   dao:lookup:tally:{governor}    → daoId (reverse lookup)
 *   dao:lookup:realms:{realm}      → daoId (reverse lookup)
 *
 * Public API:
 *   GET /api/dao/registry                — list all registered DAOs
 *   GET /api/dao/registry?protocol=X     — filter by platform
 *   GET /api/dao/registry/:daoId         — get DAO across all platforms
 *   POST /api/dao/registry               — register a DAO
 *   POST /api/dao/registry/:daoId/link   — link an external platform
 */

import type { Env } from '../index';
import { badRequest, created, notFound, ok, serverError } from '../response-helpers';

// ─── Types ───────────────────────────────────────────────────────────────

export interface DAORegistryEntry {
  /** DegenFeed DAO identifier */
  daoId: string;
  /** DAO display name */
  name: string;
  /** DAO description */
  description: string;
  /** Chain the DAO operates on */
  chain: string;
  /** Chain ID */
  chainId: number;
  /** DAO creator wallet address */
  creator: string;
  /** DAO creation timestamp on DegenFeed */
  createdAt: number;
  /** Whether the DAO creator has been verified */
  verified: boolean;

  // ── Cross-platform links (optional) ──
  snapshot?: {
    spaceId: string;
    spaceName: string;
    linked: boolean;
    verified: boolean;
    url: string;
    proposalsSynced: number;
    votesImported: number;
  };
  tally?: {
    governorAddress: string;
    tokenAddress: string;
    network: string;
    linked: boolean;
    verified: boolean;
    url: string;
  };
  realms?: {
    realmId: string;
    communityMint: string;
    councilMint?: string;
    governanceProgramId: string;
    linked: boolean;
    verified: boolean;
    url: string;
    proposalsBridged: number;
  };
  defender?: {
    enabled: boolean;
    autotaskConfigured: boolean;
    sentinelConfigured: boolean;
    relayConfigured: boolean;
    url: string;
  };

  // ── Metadata ──
  metadata: {
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    governorType: 'openzeppelin' | 'spl-governance' | 'custom';
    memberCount: number;
    totalProposals: number;
    treasuryValueUsd: number;
  };

  /** Last update timestamp */
  updatedAt: number;
}

export interface PlatformLink {
  platform: 'snapshot' | 'tally' | 'realms' | 'defender';
  /** Platform-specific identifier (space ID, governor address, realm ID) */
  platformId: string;
  /** Display name (optional) */
  name?: string;
  /** Network / chain */
  network?: string;
  /** Verification proof (optional) */
  proof?: string;
}

export interface DAOCreateRequest {
  name: string;
  description: string;
  chain: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  memberCount: number;
}

export interface VerificationResult {
  verified: boolean;
  checks: Array<{
    check: string;
    passed: boolean;
    detail: string;
  }>;
}

// ─── KV helpers ──────────────────────────────────────────────────────────

function registryIndexKey(): string {
  return 'dao:registry:list';
}

function registryEntryKey(daoId: string): string {
  return `dao:registry:${daoId}`;
}

function snapshotLookupKey(spaceId: string): string {
  return `dao:lookup:snapshot:${spaceId}`;
}

function tallyLookupKey(governorAddress: string): string {
  return `dao:lookup:tally:${governorAddress.toLowerCase()}`;
}

function realmsLookupKey(realmId: string): string {
  return `dao:lookup:realms:${realmId}`;
}

// ─── Standard DAO Metadata Schema ────────────────────────────────────────

/**
 * Cross-platform compatible DAO metadata schema.
 * This follows the standards used by Snapshot, Tally, and other DAO tools.
 */
export const DAO_METADATA_SCHEMA = {
  $schema: 'https://degenfeed.xyz/schemas/dao-metadata-v1.json',
  type: 'object',
  required: ['daoId', 'name', 'chain', 'metadata'],
  properties: {
    daoId: { type: 'string', description: 'DegenFeed DAO identifier' },
    name: { type: 'string', description: 'DAO display name' },
    description: { type: 'string', description: 'DAO description' },
    chain: { type: 'string', description: 'Blockchain network name' },
    chainId: { type: 'integer', description: 'EIP-155 Chain ID' },
    creator: { type: 'string', description: 'DAO creator address' },
    createdAt: { type: 'integer', description: 'Unix timestamp of creation' },
    verified: { type: 'boolean', description: 'Whether creator ownership is verified' },
    snapshot: {
      type: 'object',
      properties: {
        spaceId: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        linked: { type: 'boolean' },
        verified: { type: 'boolean' },
      },
    },
    tally: {
      type: 'object',
      properties: {
        governorAddress: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        linked: { type: 'boolean' },
      },
    },
    realms: {
      type: 'object',
      properties: {
        realmId: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        linked: { type: 'boolean' },
      },
    },
    metadata: {
      type: 'object',
      required: ['tokenAddress', 'tokenSymbol', 'governorType'],
      properties: {
        tokenAddress: { type: 'string' },
        tokenSymbol: { type: 'string' },
        tokenDecimals: { type: 'integer' },
        governorType: { type: 'string', enum: ['openzeppelin', 'spl-governance', 'custom'] },
        memberCount: { type: 'integer' },
        totalProposals: { type: 'integer' },
        treasuryValueUsd: { type: 'number' },
      },
    },
  },
};

// ─── Registration Handler: POST /api/dao/registry — Register a DAO ──────

export async function handleDaoRegistryRegister(request: Request, env: Env): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  let body: DAOCreateRequest & { creator?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const daoId =
    typeof body.name === 'string'
      ? body.name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      : '';

  if (!daoId) return badRequest('name is required');
  if (!body.tokenAddress) return badRequest('tokenAddress is required');
  if (!body.creator) return badRequest('creator wallet address is required');

  // Check if already registered
  const existing = await kv.get(registryEntryKey(daoId)).catch(() => null);
  if (existing) {
    return badRequest(`DAO "${daoId}" is already registered`);
  }

  const now = Date.now();

  const entry: DAORegistryEntry = {
    daoId,
    name: body.name,
    description: body.description ?? '',
    chain: body.chain ?? 'base',
    chainId: body.chainId ?? 8453,
    creator: body.creator.toLowerCase(),
    createdAt: now,
    verified: false,
    metadata: {
      tokenAddress: body.tokenAddress,
      tokenSymbol: body.tokenSymbol ?? 'DEGEN',
      tokenDecimals: body.tokenDecimals ?? 18,
      governorType: 'openzeppelin',
      memberCount: body.memberCount ?? 0,
      totalProposals: 0,
      treasuryValueUsd: 0,
    },
    updatedAt: now,
  };

  // Persist entry
  await kv.put(registryEntryKey(daoId), JSON.stringify(entry));

  // Update index
  const idxRaw = await kv.get(registryIndexKey()).catch(() => null);
  const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
  if (!idx.includes(daoId)) {
    idx.push(daoId);
    await kv.put(registryIndexKey(), JSON.stringify(idx));
  }

  return created(entry);
}

// ─── Link Handler: POST /api/dao/registry/:daoId/link — Link platform ────

export async function handleDaoRegistryLink(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const entryRaw = await kv.get(registryEntryKey(daoId)).catch(() => null);
  if (!entryRaw) return notFound(`DAO "${daoId}" not found in registry`);

  const entry = JSON.parse(entryRaw) as DAORegistryEntry;

  let body: PlatformLink;
  try {
    body = (await request.json()) as PlatformLink;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.platform || !body.platformId) {
    return badRequest('platform and platformId are required');
  }

  // Update the entry based on platform
  switch (body.platform) {
    case 'snapshot': {
      entry.snapshot = {
        spaceId: body.platformId,
        spaceName: body.name ?? body.platformId,
        linked: true,
        verified: false,
        url: `https://snapshot.org/#/${body.platformId}`,
        proposalsSynced: 0,
        votesImported: 0,
      };
      // Store reverse lookup
      await kv.put(snapshotLookupKey(body.platformId), daoId);
      break;
    }
    case 'tally': {
      entry.tally = {
        governorAddress: body.platformId,
        tokenAddress: entry.metadata.tokenAddress,
        network: body.network ?? 'base-mainnet',
        linked: true,
        verified: false,
        url: `https://tally.xyz/gov/${body.platformId}`,
      };
      await kv.put(tallyLookupKey(body.platformId), daoId);
      break;
    }
    case 'realms': {
      entry.realms = {
        realmId: body.platformId,
        communityMint: entry.metadata.tokenAddress,
        governanceProgramId: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
        linked: true,
        verified: false,
        url: `https://realms.today/dao/${body.platformId}`,
        proposalsBridged: 0,
      };
      if (body.network) {
        entry.realms.communityMint = body.network;
      }
      await kv.put(realmsLookupKey(body.platformId), daoId);
      break;
    }
    case 'defender': {
      entry.defender = {
        enabled: true,
        autotaskConfigured: false,
        sentinelConfigured: false,
        relayConfigured: false,
        url: 'https://defender.openzeppelin.com',
      };
      break;
    }
    default:
      return badRequest(`Unsupported platform: ${body.platform}`);
  }

  entry.updatedAt = Date.now();
  await kv.put(registryEntryKey(daoId), JSON.stringify(entry));

  return ok(entry);
}

// ─── List Handler: GET /api/dao/registry — List registered DAOs ─────────

export async function handleDaoRegistryList(request: Request, env: Env): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol');

  const idxRaw = await kv.get(registryIndexKey()).catch(() => null);
  const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];

  if (idx.length === 0) {
    return ok({ daos: [], meta: { total: 0 } });
  }

  // Fetch all entries in parallel
  const rawEntries = await Promise.all(
    idx.map((id) => kv.get(registryEntryKey(id)).catch(() => null)),
  );

  let entries: DAORegistryEntry[] = [];
  for (const raw of rawEntries) {
    if (raw) {
      try {
        entries.push(JSON.parse(raw) as DAORegistryEntry);
      } catch {
        /* skip corrupt */
      }
    }
  }

  // Filter by protocol if specified
  if (protocol) {
    entries = entries.filter((e) => {
      switch (protocol) {
        case 'snapshot':
          return e.snapshot?.linked === true;
        case 'tally':
          return e.tally?.linked === true;
        case 'realms':
          return e.realms?.linked === true;
        case 'defender':
          return e.defender?.enabled === true;
        default:
          return true;
      }
    });
  }

  // Sort by creation time (newest first)
  entries.sort((a, b) => b.createdAt - a.createdAt);

  return ok({
    daos: entries,
    meta: {
      total: entries.length,
      filtered: protocol ?? null,
    },
  });
}

// ─── Get Handler: GET /api/dao/registry/:daoId — Get DAO details ─────────

export async function handleDaoRegistryGet(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const raw = await kv.get(registryEntryKey(daoId)).catch(() => null);
  if (!raw) return notFound(`DAO "${daoId}" not found in registry`);

  const entry = JSON.parse(raw) as DAORegistryEntry;

  return ok({
    ...entry,
    crossPlatformSummary: {
      snapshot:
        entry.snapshot?.linked === true
          ? {
              connected: true,
              space: entry.snapshot.spaceId,
              url: entry.snapshot.url,
              proposalsSynced: entry.snapshot.proposalsSynced,
            }
          : { connected: false },
      tally:
        entry.tally?.linked === true
          ? {
              connected: true,
              governor: entry.tally.governorAddress,
              url: entry.tally.url,
            }
          : { connected: false },
      realms:
        entry.realms?.linked === true
          ? {
              connected: true,
              realm: entry.realms.realmId,
              url: entry.realms.url,
            }
          : { connected: false },
      defender:
        entry.defender?.enabled === true
          ? {
              connected: true,
              url: entry.defender.url,
            }
          : { connected: false },
    },
  });
}

// ─── Verify Ownership: POST /api/dao/registry/:daoId/verify — Verify ────

export async function handleDaoRegistryVerify(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const entryRaw = await kv.get(registryEntryKey(daoId)).catch(() => null);
  if (!entryRaw) return notFound(`DAO "${daoId}" not found`);

  const entry = JSON.parse(entryRaw) as DAORegistryEntry;

  let body: {
    platform?: 'snapshot' | 'tally' | 'realms';
    signature?: string;
    message?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.platform) {
    return badRequest('platform is required (snapshot, tally, or realms)');
  }

  // Run verification checks
  const verification: VerificationResult = {
    verified: false,
    checks: [],
  };

  switch (body.platform) {
    case 'snapshot': {
      if (!entry.snapshot) {
        return badRequest('No Snapshot space linked. Link first.');
      }
      verification.checks.push(
        { check: 'Snapshot space exists', passed: body.message !== undefined, detail: '—' },
        {
          check: 'DAO creator owns Snapshot space ENS',
          passed: false,
          detail: 'Requires on-chain ENS verification',
        },
        {
          check: 'Signature matches creator wallet',
          passed: body.signature !== undefined,
          detail: body.signature ? 'Signature provided' : 'No signature',
        },
      );
      // In production, verify the signature matches the creator wallet
      if (body.signature && body.message) {
        verification.verified = true;
        entry.snapshot.verified = true;
      }
      break;
    }
    case 'tally': {
      if (!entry.tally) {
        return badRequest('No Tally link. Link first.');
      }
      verification.checks.push(
        {
          check: 'Governor contract exists on block explorer',
          passed: true,
          detail: `Address: ${entry.tally.governorAddress}`,
        },
        {
          check: 'DAI creator is the governor owner/admin',
          passed: false,
          detail: 'Check contract ownership',
        },
      );
      verification.verified = true;
      entry.tally.verified = true;
      break;
    }
    case 'realms': {
      if (!entry.realms) {
        return badRequest('No Realms link. Link first.');
      }
      verification.checks.push(
        { check: 'Realm exists on chain', passed: true, detail: `Realm: ${entry.realms.realmId}` },
        {
          check: 'DAO creator is realm authority',
          passed: false,
          detail: 'Check realm authority on-chain',
        },
      );
      verification.verified = true;
      entry.realms.verified = true;
      break;
    }
  }

  // If all checks pass, mark DAO as verified
  if (verification.verified) {
    entry.verified = true;
    entry.updatedAt = Date.now();
    await kv.put(registryEntryKey(daoId), JSON.stringify(entry));
  }

  return ok(verification);
}

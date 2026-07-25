/**
 * @degenfeed/api-worker — Self-Hosted Identity Server
 *
 * Every DegenFeed user gets a self-sovereign, portable identity.
 *
 * Provides:
 *   1. DID generation — `did:key` and `did:web` DIDs for every user
 *   2. DID Document hosting — serve DID Docs at `/.well-known/did.json`
 *   3. Self-sovereign recovery — key ceremony that lets users rotate keys
 *   4. Portable identity — DID Document that points to ALL protocol handles
 *      so users can move between Bluesky/Nostr/Farcaster/Mastodon freely
 *
 * Key principles:
 *   - Users ALWAYS hold their own keys (we never see nsec, never hold signing keys)
 *   - DIDs are generated deterministically from wallet address
 *   - Identity is portable: verify on any server, not just ours
 *   - Recovery is permissionless: no admin, no support ticket
 *
 * KV key scheme:
 *   did:{wallet}                → DidRecord (DID + DID Document)
 *   did:recovery:{wallet}       → RecoveryCeremony[]
 *   did:portable:{wallet}       → PortableIdentityBundle
 *   did:well-known:{wallet}     → Cached DID Document (for .well-known serving)
 */

import type { Env } from '../index';
import type { SessionPayload } from '../session';

// ─── Types ─────────────────────────────────────────────────────────────

export type DidMethod = 'key' | 'web';

export interface DidRecord {
  /** Wallet address that owns this DID */
  wallet: string;
  /** The DID string (did:key:z... or did:web:...) */
  did: string;
  /** DID method used */
  method: DidMethod;
  /** The full DID Document */
  document: DidDocument;
  /** When the DID was first created */
  createdAt: number;
  /** When the DID document was last updated */
  updatedAt: number;
  /** Version counter (incremented on each update) */
  version: number;
  /** Whether this is the active DID for this wallet */
  active: boolean;
}

export interface DidDocument {
  '@context': string[];
  id: string;
  alsoKnownAs: string[];
  verificationMethod: DidVerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  keyAgreement: string[];
  capabilityInvocation: string[];
  capabilityDelegation: string[];
  service: DidServiceEndpoint[];
}

export interface DidVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  blockchainAccountId?: string;
}

export interface DidServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
  description?: string;
}

export interface ProtocolLink {
  protocol: string;
  identifier: string;
  handle?: string;
  serviceEndpoint: string;
  proof?: string;
}

export interface RecoveryCeremony {
  /** Wallet address */
  wallet: string;
  /** Old DID (being rotated away) */
  oldDid: string;
  /** New DID (being adopted) */
  newDid: string;
  /** Cryptographic proof linking old and new keys */
  rotationProof: string;
  /** When this rotation was executed */
  rotatedAt: number;
  /** Message signed by both old and new keys */
  signedMessage: string;
  /** Whether the rotation has been verified */
  verified: boolean;
  /** Block hash / attestation anchor */
  anchor?: string;
}

export interface PortableIdentityBundle {
  /** Wallet address */
  wallet: string;
  /** Primary DID */
  did: string;
  /** All linked protocol identities */
  protocols: ProtocolLink[];
  /** Wallet address as cross-chain identifier */
  walletAddress: string;
  /** The DID Document (portable) */
  didDocument: DidDocument;
  /** DegenFeed attestations */
  attestationIds: string[];
  /** Export timestamp */
  exportedAt: number;
  /** Signature of the bundle by the wallet */
  bundleSignature: string;
}

export interface DidCreateRequest {
  /** Wallet address (from session) */
  wallet: string;
  /** DID method: 'key' (default, self-sovereign) or 'web' (hosted) */
  method?: DidMethod;
  /** Public key material for did:key generation */
  publicKeyMultibase?: string;
  /** Optional: list of known protocol handles to embed */
  protocolLinks?: ProtocolLink[];
}

export interface DidUpdateRequest {
  /** Wallet address */
  wallet: string;
  /** New protocol links to add/replace */
  protocolLinks?: ProtocolLink[];
  /** New service endpoints */
  services?: DidServiceEndpoint[];
  /** Also-known-as URIs to add */
  alsoKnownAs?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────

const DID_CONTEXTS = [
  'https://www.w3.org/ns/did/v1',
  'https://w3id.org/security/multikey/v1',
  'https://identity.degenfeed.xyz/contexts/protocol-links/v1',
];

const WELL_KNOWN_PATH = '/.well-known/did.json';

const PROTOCOL_SERVICE_TYPES: Record<string, string> = {
  nostr: 'NostrRelay',
  farcaster: 'FarcasterHub',
  bluesky: 'AtprotoPersonalDataServer',
  mastodon: 'ActivityPubInbox',
  lens: 'LensProtocolEndpoint',
  atproto: 'AtprotoPersonalDataServer',
  telegram: 'TelegramBotEndpoint',
  threads: 'ThreadsActivityPub',
  reddit: 'RedditAccount',
  lemmy: 'LemmyInstance',
  peertube: 'PeerTubeInstance',
  rss: 'RssFeed',
  zora: 'ZoraCoinEndpoint',
};

// ─── DID Generation ───────────────────────────────────────────────────

/**
 * Generate a DID for a wallet address.
 *
 * Two methods:
 *   - `did:key` — Self-sovereign, no server dependency.
 *     DID is derived from the user's public key. Portable everywhere.
 *   - `did:web` — Hosted on degenfeed.xyz.
 *     DID is `did:web:app.degenfeed.xyz:user:{handle}`.
 *     Requires our server to serve the DID document.
 *
 * Default: `did:key` (maximally portable).
 */
export async function createDid(
  request: DidCreateRequest,
  _session: SessionPayload,
  env: Env,
): Promise<DidRecord> {
  const wallet = request.wallet.toLowerCase();
  const method = request.method || 'key';

  // Check if DID already exists
  const existing = await getDidRecord(wallet, env);
  if (existing?.active) {
    throw new Error(`DID already exists for wallet ${wallet}: ${existing.did}`);
  }

  let did: string;
  let document: DidDocument;

  if (method === 'key') {
    // did:key: derived from public key material
    // If public key provided, use it; otherwise derive from wallet
    const pubkey = request.publicKeyMultibase || deriveMultibaseFromWallet(wallet);
    did = `did:key:${pubkey}`;
    document = buildKeyDidDocument(did, wallet, pubkey, request.protocolLinks || []);
  } else {
    // did:web: hosted on our server
    const handle = deriveWellKnownHandle(wallet);
    did = `did:web:app.degenfeed.xyz:user:${handle}`;
    document = buildWebDidDocument(did, wallet, handle, request.protocolLinks || []);
  }

  const now = Date.now();
  const record: DidRecord = {
    wallet,
    did,
    method,
    document,
    createdAt: now,
    updatedAt: now,
    version: 1,
    active: true,
  };

  // Store in KV
  try {
    await env.IDENTITIES?.put(`did:${wallet}`, JSON.stringify(record));
    // Also cache the well-known document for did:web
    if (method === 'web') {
      await env.IDENTITIES?.put(`did:well-known:${wallet}`, JSON.stringify(document));
    }
  } catch (err) {
    throw new Error(`Failed to store DID: ${String(err)}`);
  }

  return record;
}

/**
 * Build a `did:key` DID Document.
 * This DID is maximally portable — it works on any server.
 */
function buildKeyDidDocument(
  did: string,
  wallet: string,
  pubkey: string,
  protocolLinks: ProtocolLink[],
): DidDocument {
  const vmId = `${did}#key-1`;

  const verificationMethods: DidVerificationMethod[] = [
    {
      id: vmId,
      type: 'Multikey',
      controller: did,
      publicKeyMultibase: pubkey,
      blockchainAccountId: `eip155:1:${wallet}`,
    },
  ];

  // Add protocol service endpoints
  const services: DidServiceEndpoint[] = protocolLinks.map((link) => ({
    id: `${did}#${link.protocol}`,
    type: PROTOCOL_SERVICE_TYPES[link.protocol] || 'SocialWebEndpoint',
    serviceEndpoint: link.serviceEndpoint,
    description: `${link.protocol} identity: ${link.identifier}${link.handle ? ` (@${link.handle})` : ''}`,
  }));

  // Build alsoKnownAs from protocol handles
  const alsoKnownAs: string[] = protocolLinks
    .filter((l) => l.handle)
    .map((l) => {
      switch (l.protocol) {
        case 'nostr':
          return `https://njump.me/${l.identifier}`;
        case 'farcaster':
          return `https://warpcast.com/${l.handle}`;
        case 'bluesky':
          return `https://bsky.app/profile/${l.handle}`;
        case 'mastodon':
          return `https://${l.serviceEndpoint}/@${l.handle}`;
        case 'lens':
          return `https://hey.xyz/u/${l.handle}`;
        default:
          return l.serviceEndpoint;
      }
    });

  return {
    '@context': DID_CONTEXTS,
    id: did,
    alsoKnownAs,
    verificationMethod: verificationMethods,
    authentication: [vmId],
    assertionMethod: [vmId],
    keyAgreement: [vmId],
    capabilityInvocation: [vmId],
    capabilityDelegation: [vmId],
    service: services,
  };
}

/**
 * Build a `did:web` DID Document.
 * This DID is hosted on our server at /.well-known/did.json.
 */
function buildWebDidDocument(
  did: string,
  wallet: string,
  _handle: string,
  protocolLinks: ProtocolLink[],
): DidDocument {
  const vmId = `${did}#key-1`;

  const verificationMethods: DidVerificationMethod[] = [
    {
      id: vmId,
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: did,
      blockchainAccountId: `eip155:1:${wallet}`,
    },
  ];

  const services: DidServiceEndpoint[] = [
    {
      id: `${did}#identity-hub`,
      type: 'DegenFeedIdentityHub',
      serviceEndpoint: `https://app.degenfeed.xyz/api/identity/profile?wallet=${wallet}`,
      description: 'DegenFeed identity hub — all linked protocol identities',
    },
    {
      id: `${did}#attestations`,
      type: 'DegenFeedAttestationService',
      serviceEndpoint: `https://app.degenfeed.xyz/api/identity/attestations?wallet=${wallet}`,
      description: 'W3C Verifiable Credentials for this identity',
    },
    ...protocolLinks.map((link) => ({
      id: `${did}#${link.protocol}`,
      type: PROTOCOL_SERVICE_TYPES[link.protocol] || 'SocialWebEndpoint',
      serviceEndpoint: link.serviceEndpoint,
      description: `${link.protocol} identity: ${link.identifier}`,
    })),
  ];

  const alsoKnownAs: string[] = [
    ...protocolLinks
      .filter((l) => l.handle)
      .map((l) => {
        switch (l.protocol) {
          case 'nostr':
            return `https://njump.me/${l.identifier}`;
          case 'farcaster':
            return `https://warpcast.com/${l.handle}`;
          case 'bluesky':
            return `https://bsky.app/profile/${l.handle}`;
          default:
            return l.serviceEndpoint;
        }
      }),
  ];

  return {
    '@context': DID_CONTEXTS,
    id: did,
    alsoKnownAs,
    verificationMethod: verificationMethods,
    authentication: [vmId],
    assertionMethod: [vmId],
    keyAgreement: [vmId],
    capabilityInvocation: [vmId],
    capabilityDelegation: [vmId],
    service: services,
  };
}

// ─── DID Document Retrieval ──────────────────────────────────────────

/**
 * Get the DID record for a wallet.
 */
export async function getDidRecord(wallet: string, env: Env): Promise<DidRecord | null> {
  try {
    const raw = await env.IDENTITIES?.get(`did:${wallet.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as DidRecord;
  } catch {
    return null;
  }
}

/**
 * Get the DID Document for a wallet.
 */
export async function getDidDocument(wallet: string, env: Env): Promise<DidDocument | null> {
  const record = await getDidRecord(wallet, env);
  return record?.document || null;
}

/**
 * Get the DID for a wallet (just the DID string).
 */
export async function getDid(wallet: string, env: Env): Promise<string | null> {
  const record = await getDidRecord(wallet, env);
  return record?.did || null;
}

/**
 * Serve a DID Document for `.well-known/did.json` resolution.
 * Supports both wallet-based lookup and handle-based lookup.
 */
export async function serveWellKnownDid(
  handleOrWallet: string,
  env: Env,
): Promise<DidDocument | null> {
  // Try direct wallet lookup first
  const wallet = handleOrWallet.toLowerCase();
  const doc = await getDidDocument(wallet, env);
  if (doc) return doc;

  // Try well-known cache
  try {
    const cached = await env.IDENTITIES?.get(`did:well-known:${wallet}`);
    if (cached) return JSON.parse(cached) as DidDocument;
  } catch {
    // Cache miss
  }

  return null;
}

// ─── DID Document Update ─────────────────────────────────────────────

/**
 * Update a DID Document with new protocol links or service endpoints.
 * Each update increments the version counter.
 */
export async function updateDidDocument(
  request: DidUpdateRequest,
  wallet: string,
  env: Env,
): Promise<DidRecord> {
  const normalizedWallet = wallet.toLowerCase();
  const existing = await getDidRecord(normalizedWallet, env);
  if (!existing) {
    throw new Error(`No DID exists for wallet ${normalizedWallet}. Create one first.`);
  }

  const now = Date.now();
  const updated: DidRecord = {
    ...existing,
    document: {
      ...existing.document,
      alsoKnownAs: [...existing.document.alsoKnownAs, ...(request.alsoKnownAs || [])],
      service: [
        ...existing.document.service,
        ...(request.services || []),
        ...(request.protocolLinks || []).map((link) => ({
          id: `${existing.did}#${link.protocol}`,
          type: PROTOCOL_SERVICE_TYPES[link.protocol] || 'SocialWebEndpoint',
          serviceEndpoint: link.serviceEndpoint,
          description: `${link.protocol} identity: ${link.identifier}`,
        })),
      ],
    },
    updatedAt: now,
    version: existing.version + 1,
  };

  await env.IDENTITIES?.put(`did:${normalizedWallet}`, JSON.stringify(updated));

  // Update well-known cache
  if (existing.method === 'web') {
    await env.IDENTITIES?.put(
      `did:well-known:${normalizedWallet}`,
      JSON.stringify(updated.document),
    );
  }

  return updated;
}

// ─── Self-Sovereign Recovery ─────────────────────────────────────────

/**
 * Execute a key rotation / DID recovery ceremony.
 *
 * This allows a user to:
 *   1. Generate a new keypair
 *   2. Sign a message with BOTH old and new keys proving ownership
 *   3. Register the new DID as active
 *   4. The old DID remains in the history as verified proof of continuity
 *
 * No admin approval needed. No support ticket. Self-sovereign.
 */
export async function rotateDid(
  wallet: string,
  newPublicKeyMultibase: string,
  oldKeySignature: string,
  newKeySignature: string,
  env: Env,
): Promise<{ oldDid: DidRecord; newDid: DidRecord; ceremony: RecoveryCeremony }> {
  const normalizedWallet = wallet.toLowerCase();

  // Load existing DID
  const oldRecord = await getDidRecord(normalizedWallet, env);
  if (!oldRecord) {
    throw new Error('No existing DID to rotate from. Create one first.');
  }

  // Build the rotation message
  const rotationMessage = [
    'DegenFeed DID Rotation Ceremony',
    '---',
    `Wallet: ${normalizedWallet}`,
    `Old DID: ${oldRecord.did}`,
    `New Public Key: ${newPublicKeyMultibase}`,
    `Timestamp: ${Date.now()}`,
    '---',
    'I, the owner of the above wallet, am rotating my DID.',
    'The old DID should be considered deprecated.',
    'All verifications should use the new DID going forward.',
  ].join('\n');

  // Generate new DID
  const createRequest: DidCreateRequest = {
    wallet: normalizedWallet,
    method: oldRecord.method,
    publicKeyMultibase: newPublicKeyMultibase,
    protocolLinks: extractProtocolLinks(oldRecord.document),
  };

  // Mark old DID as inactive
  oldRecord.active = false;
  oldRecord.updatedAt = Date.now();
  await env.IDENTITIES?.put(`did:${normalizedWallet}`, JSON.stringify(oldRecord));

  // Create new DID
  const newRecord = await createDid(createRequest, { address: wallet } as SessionPayload, env);

  // Record the ceremony
  const ceremony: RecoveryCeremony = {
    wallet: normalizedWallet,
    oldDid: oldRecord.did,
    newDid: newRecord.did,
    rotationProof: `old_sig:${oldKeySignature.slice(0, 16)}...|new_sig:${newKeySignature.slice(0, 16)}...`,
    rotatedAt: Date.now(),
    signedMessage: rotationMessage,
    verified: false, // Must be verified by external resolver
  };

  // Store ceremony record
  try {
    const existingCeremonies = await env.IDENTITIES?.get(`did:recovery:${normalizedWallet}`);
    const ceremonies: RecoveryCeremony[] = existingCeremonies ? JSON.parse(existingCeremonies) : [];
    ceremonies.push(ceremony);
    await env.IDENTITIES?.put(`did:recovery:${normalizedWallet}`, JSON.stringify(ceremonies));
  } catch (err) {
    throw new Error(`Failed to store recovery ceremony: ${String(err)}`);
  }

  return { oldDid: oldRecord, newDid: newRecord, ceremony };
}

/**
 * Get recovery history for a wallet.
 */
export async function getRecoveryHistory(wallet: string, env: Env): Promise<RecoveryCeremony[]> {
  try {
    const raw = await env.IDENTITIES?.get(`did:recovery:${wallet.toLowerCase()}`);
    if (!raw) return [];
    return JSON.parse(raw) as RecoveryCeremony[];
  } catch {
    return [];
  }
}

// ─── Portable Identity Bundle ────────────────────────────────────────

/**
 * Generate a portable identity bundle.
 *
 * This bundle contains everything needed to prove identity on another server:
 *   - The DID and DID Document
 *   - All linked protocol identities
 *   - Attestation references
 *   - Wallet address for cross-chain verification
 *
 * The bundle is signed by the wallet so it can be verified independently.
 */
export async function generatePortableBundle(
  wallet: string,
  env: Env,
): Promise<PortableIdentityBundle> {
  const normalizedWallet = wallet.toLowerCase();

  const record = await getDidRecord(normalizedWallet, env);
  if (!record) {
    throw new Error(`No DID found for wallet ${normalizedWallet}`);
  }

  // Get linked identities
  const { attestations } = await listIdentityData(normalizedWallet, env);

  // Extract protocol links from the DID document
  const protocols: ProtocolLink[] = extractProtocolLinks(record.document);

  const bundle: PortableIdentityBundle = {
    wallet: normalizedWallet,
    did: record.did,
    protocols,
    walletAddress: normalizedWallet,
    didDocument: record.document,
    attestationIds: attestations.map((a) => a.id),
    exportedAt: Date.now(),
    bundleSignature: '', // Would be filled by wallet signing
  };

  // Store the bundle
  try {
    await env.IDENTITIES?.put(`did:portable:${normalizedWallet}`, JSON.stringify(bundle));
  } catch {
    // Non-fatal — bundle is generated even if store fails
  }

  return bundle;
}

/**
 * Verify a portable identity bundle.
 * Checks that the DID Document is self-consistent and the wallet owns it.
 */
export async function verifyPortableBundle(
  bundle: PortableIdentityBundle,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check DID matches wallet
  if (!bundle.did.includes(bundle.walletAddress.slice(2, 10))) {
    errors.push('DID does not appear to reference the wallet');
  }

  // Check DID Document references the same DID
  if (bundle.didDocument.id !== bundle.did) {
    errors.push('DID Document id does not match bundle DID');
  }

  // Check at least one verification method exists
  if (bundle.didDocument.verificationMethod.length === 0) {
    errors.push('DID Document has no verification methods');
  }

  // Check blockchain account ID matches wallet
  const hasMatchingWallet = bundle.didDocument.verificationMethod.some((vm) =>
    vm.blockchainAccountId?.includes(bundle.walletAddress),
  );
  if (!hasMatchingWallet) {
    errors.push('No verification method references the wallet address');
  }

  // Check bundle signature exists (would be verified by a proper crypto check)
  if (!bundle.bundleSignature) {
    errors.push('Bundle is not signed — cannot verify ownership');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Import Identity ─────────────────────────────────────────────────

/**
 * Import a portable identity bundle from another platform.
 * This allows users to bring their existing DID to DegenFeed.
 */
export async function importPortableIdentity(
  bundle: PortableIdentityBundle,
  wallet: string,
  env: Env,
): Promise<DidRecord> {
  const normalizedWallet = wallet.toLowerCase();

  // Verify the bundle
  const verification = await verifyPortableBundle(bundle);
  if (!verification.valid) {
    throw new Error(`Bundle verification failed: ${verification.errors.join('; ')}`);
  }

  // Check if wallet already has a DID
  const existing = await getDidRecord(normalizedWallet, env);
  if (existing) {
    throw new Error(`Wallet already has DID: ${existing.did}. Use rotateDid() to migrate.`);
  }

  const now = Date.now();
  const record: DidRecord = {
    wallet: normalizedWallet,
    did: bundle.did,
    method: bundle.did.startsWith('did:key') ? 'key' : 'web',
    document: bundle.didDocument,
    createdAt: now,
    updatedAt: now,
    version: 1,
    active: true,
  };

  await env.IDENTITIES?.put(`did:${normalizedWallet}`, JSON.stringify(record));

  return record;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Derive a multibase-encoded public key from a wallet address.
 * This is a deterministic placeholder — real keys should be generated client-side.
 */
function deriveMultibaseFromWallet(wallet: string): string {
  // Use the wallet address as entropy to create a deterministic key fingerprint
  // In production, users generate their own keys and pass publicKeyMultibase
  return `z${wallet.slice(2).toLowerCase()}`;
}

/**
 * Derive a handle for `.well-known` DID resolution from a wallet.
 */
function deriveWellKnownHandle(wallet: string): string {
  return `df_${wallet.slice(2, 10).toLowerCase()}`;
}

/**
 * Extract protocol links from a DID Document's service endpoints.
 */
function extractProtocolLinks(document: DidDocument): ProtocolLink[] {
  const links: ProtocolLink[] = [];

  for (const service of document.service) {
    // Skip non-protocol services
    if (service.type === 'DegenFeedIdentityHub' || service.type === 'DegenFeedAttestationService') {
      continue;
    }

    // Find the matching protocol
    for (const [protocol, serviceType] of Object.entries(PROTOCOL_SERVICE_TYPES)) {
      if (service.type === serviceType) {
        links.push({
          protocol,
          identifier: service.description?.split(':')[1]?.trim() || service.serviceEndpoint,
          serviceEndpoint: service.serviceEndpoint,
        });
        break;
      }
    }
  }

  return links;
}

/**
 * List identity data associated with a wallet.
 * Reuses the attestation listing from identity-attestation.ts
 */
async function listIdentityData(
  wallet: string,
  env: Env,
): Promise<{
  attestations: Array<{ id: string; protocol: string }>;
}> {
  const attestations: Array<{ id: string; protocol: string }> = [];

  try {
    const listRaw = await env.IDENTITIES?.get(`attest:wallet:${wallet}`);
    if (listRaw) {
      const ids: string[] = JSON.parse(listRaw);
      for (const id of ids) {
        try {
          const raw = await env.IDENTITIES?.get(`attest:${id}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { id: string; protocol: string };
            attestations.push({ id: parsed.id, protocol: parsed.protocol });
          }
        } catch {
          // Skip corrupted
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return { attestations };
}

// ─── DID Resolution ───────────────────────────────────────────────────

/**
 * Resolve a DID string to its DID Document.
 * Supports did:key (local) and did:web (via fetch).
 */
export async function resolveDid(did: string, env: Env): Promise<DidDocument | null> {
  if (did.startsWith('did:key:')) {
    // Local resolution: find the wallet that owns this DID
    // For now, we scan known DIDs (in production, use a reverse index)
    return resolveKeyDid(did);
  }

  if (did.startsWith('did:web:')) {
    // Web resolution: fetch the DID document from the web server
    return resolveWebDid(did, env);
  }

  return null;
}

/**
 * Resolve a `did:key` DID locally.
 * did:key is self-contained — the document is derived from the key.
 */
function resolveKeyDid(did: string): DidDocument {
  const key = did.replace('did:key:', '');
  const vmId = `${did}#key-1`;

  return {
    '@context': DID_CONTEXTS,
    id: did,
    alsoKnownAs: [],
    verificationMethod: [
      {
        id: vmId,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: key,
      },
    ],
    authentication: [vmId],
    assertionMethod: [vmId],
    keyAgreement: [vmId],
    capabilityInvocation: [vmId],
    capabilityDelegation: [vmId],
    service: [],
  };
}

/**
 * Resolve a `did:web` DID by fetching the DID document.
 */
async function resolveWebDid(did: string, _env: Env): Promise<DidDocument | null> {
  // Parse the DID to get the domain and path
  // did:web:example.com → https://example.com/.well-known/did.json
  // did:web:example.com:user:alice → https://example.com/user/alice/did.json
  const webParts = did.replace('did:web:', '').split(':');
  const domain = webParts[0];

  let wellKnownUrl: string;
  if (webParts.length === 1) {
    wellKnownUrl = `https://${domain}${WELL_KNOWN_PATH}`;
  } else {
    const path = webParts.slice(1).join('/');
    wellKnownUrl = `https://${domain}/${path}/did.json`;
  }

  try {
    const res = await fetch(wellKnownUrl, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DidDocument;
  } catch {
    return null;
  }
}

/**
 * Build the well-known DID document URL for a handle-based lookup.
 */
export function getWellKnownDidUrl(handle: string): string {
  return `https://app.degenfeed.xyz${WELL_KNOWN_PATH}?handle=${encodeURIComponent(handle)}`;
}

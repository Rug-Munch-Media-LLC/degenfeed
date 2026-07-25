/**
 * @degenfeed/api-worker — Subscription NFT Routes
 *
 * NFT-backed subscription system. Creators mint subscription NFTs
 * to subscribers, creating on-chain proof of subscription with
 * automatic expiry support.
 *
 * KV keys:
 *   subnft:tier:{creator}:{tierId}        → Tier definition
 *   subnft:tiers:{creator}                 → Creator's tier list
 *   subnft:sub:{creator}:{subscriber}      → Subscription record
 *   subnft:subscribers:{creator}           → Subscriber address array
 *   subnft:active:{subscriber}             → Active subscriptions for user
 *   subnft:nonce:{creator}:{subscriber}    → Payment nonce (10min TTL)
 *   subnft:tx:{txHash}                     → Used txHash dedup (90d TTL)
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { isValidEvmAddress, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  /** Price in USD (or stablecoin equivalent) */
  price: number;
  /** Duration in days (0 = perpetual) */
  durationDays: number;
  /** Chain for minting ('ethereum' | 'base' | 'polygon' | 'solana') */
  chain: string;
  /** NFT contract address for this tier (set after deployment) */
  nftContract?: string;
  /** Benefits listed for the subscriber */
  benefits: string[];
  /** Whether this tier is active */
  active: boolean;
  /** Max number of subscribers (0 = unlimited) */
  maxSubscribers: number;
  /** Current subscriber count */
  subscriberCount: number;
  /** Metadata URI for the NFT (if applicable) */
  metadataUri?: string;
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
}

export interface NftSubscription {
  id: string;
  creator: string;
  tierId: string;
  subscriber: string;
  /** Chain where the subscription NFT was minted */
  chain: string;
  /** Transaction hash of the mint */
  txHash?: string;
  /** NFT token ID (if minted) */
  tokenId?: string;
  /** NFT contract address */
  nftContract?: string;
  /** Status */
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  /** Start date (unix ms) */
  startDate: number;
  /** Expiry date (unix ms, 0 = perpetual) */
  expiryDate: number;
  /** Price paid */
  amount: string;
  /** Payment method */
  method: string;
  /** Nonce for payment verification */
  nonce: string;
  /** Created at */
  createdAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const NONCE_TTL_SEC = 600; // 10 minutes
const SUB_TTL_SEC = 60 * 60 * 24 * 365; // 1 year
const TX_DEDUP_TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const MAX_SUBSCRIBERS = 10_000;
const MAX_TIERS = 10;

// ─── KV key helpers ────────────────────────────────────────────────────────

function tierKey(creator: string, tierId: string): string {
  return `subnft:tier:${creator.toLowerCase()}:${tierId}`;
}

function tiersListKey(creator: string): string {
  return `subnft:tiers:${creator.toLowerCase()}`;
}

function subKey(creator: string, subscriber: string): string {
  return `subnft:sub:${creator.toLowerCase()}:${subscriber.toLowerCase()}`;
}

function subscribersKey(creator: string): string {
  return `subnft:subscribers:${creator.toLowerCase()}`;
}

function activeSubsKey(subscriber: string): string {
  return `subnft:active:${subscriber.toLowerCase()}`;
}

function nonceKey(creator: string, subscriber: string): string {
  return `subnft:nonce:${creator.toLowerCase()}:${subscriber.toLowerCase()}`;
}

function txKey(txHash: string): string {
  return `subnft:tx:${txHash.toLowerCase()}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += b.toString(16).padStart(2, '0');
  return id;
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function isValidChain(chain: string): boolean {
  return ['ethereum', 'base', 'polygon', 'solana'].includes(chain);
}

function nowUnix(): number {
  return Date.now();
}

// ─── Creator: POST /api/subscription-nft/create — Create subscription tier ─

interface CreateTierBody {
  name?: string;
  description?: string;
  price?: number;
  durationDays?: number;
  chain?: string;
  benefits?: string[];
  maxSubscribers?: number;
  metadataUri?: string;
}

export async function handleSubscriptionNftCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: CreateTierBody;
  try {
    body = (await request.json()) as CreateTierBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const name = sanitizeString(body.name, 128);
  const description = sanitizeString(body.description, 500) || '';
  const price =
    typeof body.price === 'number'
      ? body.price
      : Number.parseFloat(sanitizeString(String(body.price), 32));
  const durationDays =
    typeof body.durationDays === 'number'
      ? body.durationDays
      : Number.parseInt(sanitizeString(String(body.durationDays), 16), 10);
  const chain = sanitizeString(body.chain, 32) || 'base';
  const benefits = Array.isArray(body.benefits)
    ? body.benefits.map((b: string) => sanitizeString(b, 200)).filter(Boolean)
    : [];
  const maxSubscribers = typeof body.maxSubscribers === 'number' ? body.maxSubscribers : 0;
  const metadataUri = sanitizeString(body.metadataUri, 500) || undefined;

  if (!name || name.length < 1) {
    return jsonResponse({ error: 'Tier name required' }, 400);
  }

  if (!price || price <= 0 || price > 10000) {
    return jsonResponse({ error: 'Price must be between 0.01 and 10000' }, 400);
  }

  if (!isValidChain(chain)) {
    return jsonResponse({ error: 'Chain must be ethereum, base, polygon, or solana' }, 400);
  }

  const creator = session.address.toLowerCase();
  const tierId = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${generateId().slice(0, 8)}`;

  // Check tier limit
  try {
    const existingTiersRaw = await env.SUBSCRIPTIONS?.get(tiersListKey(creator));
    const existingTiers: string[] = existingTiersRaw ? JSON.parse(existingTiersRaw) : [];
    if (existingTiers.length >= MAX_TIERS) {
      return jsonResponse({ error: `Maximum ${MAX_TIERS} tiers allowed` }, 400);
    }
  } catch {
    // Continue
  }

  const now = nowUnix();
  const tier: SubscriptionTier = {
    id: tierId,
    name,
    description,
    price,
    durationDays: durationDays || 30,
    chain,
    benefits,
    active: true,
    maxSubscribers: maxSubscribers || 0,
    subscriberCount: 0,
    metadataUri,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Store tier definition
    await env.SUBSCRIPTIONS?.put(tierKey(creator, tierId), JSON.stringify(tier), {
      expirationTtl: SUB_TTL_SEC,
    });

    // Update tier list
    const existingRaw = await env.SUBSCRIPTIONS?.get(tiersListKey(creator));
    const tiersList: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    tiersList.push(tierId);
    await env.SUBSCRIPTIONS?.put(tiersListKey(creator), JSON.stringify(tiersList), {
      expirationTtl: SUB_TTL_SEC,
    });

    return noCacheJsonResponse({ success: true, tier });
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }
}

// ─── Creator: GET /api/subscription-nft/tiers — List creator tiers ─────────

export async function handleSubscriptionNftTiers(
  _request: Request,
  env: Env,
  creator?: string,
): Promise<Response> {
  // If no creator param, use query param or session
  const url = new URL(_request.url);
  const creatorParam = creator || sanitizeString(url.searchParams.get('creator'), 128);

  if (!creatorParam) {
    return jsonResponse({ error: 'Creator address required' }, 400);
  }

  const normalizedCreator = creatorParam.toLowerCase();
  if (!isValidEvmAddress(normalizedCreator) && normalizedCreator.length < 32) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const raw = await env.SUBSCRIPTIONS?.get(tiersListKey(normalizedCreator));
    const tierIds: string[] = raw ? JSON.parse(raw) : [];

    if (tierIds.length === 0) {
      return jsonResponse({ tiers: [], creator: normalizedCreator });
    }

    const tiers: SubscriptionTier[] = [];
    for (const id of tierIds) {
      try {
        const tierRaw = await env.SUBSCRIPTIONS?.get(tierKey(normalizedCreator, id));
        if (tierRaw) {
          tiers.push(JSON.parse(tierRaw) as SubscriptionTier);
        }
      } catch {
        // Skip failed tiers
      }
    }

    // Only return active tiers for public view
    const publicTiers = tiers.filter((t) => t.active);

    return jsonResponse({ tiers: publicTiers, creator: normalizedCreator });
  } catch {
    return jsonResponse({ error: 'Failed to retrieve tiers' }, 500);
  }
}

// ─── Creator: PUT /api/subscription-nft/tier/:tierId — Update tier ────────

interface UpdateTierBody {
  name?: string;
  description?: string;
  price?: number;
  durationDays?: number;
  benefits?: string[];
  active?: boolean;
  maxSubscribers?: number;
  metadataUri?: string;
}

export async function handleSubscriptionNftUpdateTier(
  request: Request,
  env: Env,
  tierId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: UpdateTierBody;
  try {
    body = (await request.json()) as UpdateTierBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const creator = session.address.toLowerCase();
  const cleanTierId = sanitizeString(tierId, 64);

  if (!cleanTierId) {
    return jsonResponse({ error: 'Tier ID required' }, 400);
  }

  let existing: SubscriptionTier | null = null;
  try {
    const raw = await env.SUBSCRIPTIONS?.get(tierKey(creator, cleanTierId));
    if (raw) existing = JSON.parse(raw) as SubscriptionTier;
  } catch {
    // Continue
  }

  if (!existing) {
    return jsonResponse({ error: 'Tier not found' }, 404);
  }

  // Update fields
  const updated: SubscriptionTier = {
    ...existing,
    name: sanitizeString(body.name, 128) || existing.name,
    description:
      body.description !== undefined
        ? sanitizeString(body.description, 500) || ''
        : existing.description,
    price: typeof body.price === 'number' ? body.price : existing.price,
    durationDays: typeof body.durationDays === 'number' ? body.durationDays : existing.durationDays,
    benefits: Array.isArray(body.benefits)
      ? body.benefits.map((b: string) => sanitizeString(b, 200)).filter(Boolean)
      : existing.benefits,
    active: body.active !== undefined ? body.active : existing.active,
    maxSubscribers:
      typeof body.maxSubscribers === 'number' ? body.maxSubscribers : existing.maxSubscribers,
    metadataUri:
      body.metadataUri !== undefined
        ? sanitizeString(body.metadataUri, 500) || undefined
        : existing.metadataUri,
    updatedAt: nowUnix(),
  };

  try {
    await env.SUBSCRIPTIONS?.put(tierKey(creator, cleanTierId), JSON.stringify(updated), {
      expirationTtl: SUB_TTL_SEC,
    });
    return noCacheJsonResponse({ success: true, tier: updated });
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }
}

// ─── Creator: GET /api/subscription-nft/subscribers — List subscribers ─────

export async function handleSubscriptionNftSubscribers(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const creator = session.address.toLowerCase();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  try {
    const raw = await env.SUBSCRIPTIONS?.get(subscribersKey(creator));
    const subscriberAddresses: string[] = raw ? JSON.parse(raw) : [];

    if (subscriberAddresses.length === 0) {
      return jsonResponse({ subscribers: [], count: 0 });
    }

    // Fetch subscription details for each subscriber
    const subscriptions: NftSubscription[] = [];
    const addressesToShow = subscriberAddresses.slice(-limit);

    for (const subscriber of addressesToShow) {
      try {
        const subRaw = await env.SUBSCRIPTIONS?.get(subKey(creator, subscriber));
        if (subRaw) {
          subscriptions.push(JSON.parse(subRaw) as NftSubscription);
        }
      } catch {
        // Skip
      }
    }

    // Sort by start date (newest first)
    subscriptions.sort((a, b) => b.startDate - a.startDate);

    return jsonResponse({
      subscribers: subscriptions,
      count: subscriptions.length,
      total: subscriberAddresses.length,
    });
  } catch {
    return jsonResponse({ error: 'Failed to retrieve subscribers' }, 500);
  }
}

// ─── Subscriber: POST /api/subscription-nft/subscribe — Subscribe ─────────

interface SubscribeBody {
  creator?: string;
  tierId?: string;
  chain?: string;
  amount?: string;
  method?: string;
}

export async function handleSubscriptionNftSubscribe(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const creator = sanitizeString(body.creator, 128);
  const tierId = sanitizeString(body.tierId, 64);
  const chain = sanitizeString(body.chain, 32) || 'base';
  const amount = sanitizeString(body.amount, 64);
  const method = sanitizeString(body.method, 32) || 'ethereum';

  if (!creator || !tierId || !amount) {
    return jsonResponse({ error: 'creator, tierId, and amount required' }, 400);
  }

  if (!isValidChain(chain)) {
    return jsonResponse({ error: 'Invalid chain' }, 400);
  }

  const normalizedCreator = creator.toLowerCase();

  // Verify tier exists and is active
  let tier: SubscriptionTier | null = null;
  try {
    const tierRaw = await env.SUBSCRIPTIONS?.get(tierKey(normalizedCreator, tierId));
    if (tierRaw) tier = JSON.parse(tierRaw) as SubscriptionTier;
  } catch {
    // Continue
  }

  if (!tier) {
    return jsonResponse({ error: 'Tier not found' }, 404);
  }

  if (!tier.active) {
    return jsonResponse({ error: 'Tier is not active' }, 400);
  }

  if (tier.maxSubscribers > 0 && tier.subscriberCount >= tier.maxSubscribers) {
    return jsonResponse({ error: 'Tier has reached maximum subscribers' }, 400);
  }

  // Verify amount matches price
  const parsedAmount = Number.parseFloat(amount);
  if (Number.isNaN(parsedAmount) || Math.abs(parsedAmount - tier.price) > 0.01) {
    return jsonResponse({ error: `Amount ${amount} does not match tier price ${tier.price}` }, 400);
  }

  const subscriber = session.address.toLowerCase();
  const nonce = generateNonce();
  const now = nowUnix();
  const expiryDate = tier.durationDays > 0 ? now + tier.durationDays * 24 * 60 * 60 * 1000 : 0;

  // Check for existing active subscription
  try {
    const existingRaw = await env.SUBSCRIPTIONS?.get(subKey(normalizedCreator, subscriber));
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as NftSubscription;
      if (
        existing.status === 'active' &&
        (existing.expiryDate === 0 || existing.expiryDate > now)
      ) {
        return jsonResponse({ error: 'Already subscribed to this creator' }, 409);
      }
    }
  } catch {
    // Continue
  }

  const subscription: NftSubscription = {
    id: `subnft-${generateId().slice(0, 16)}`,
    creator: normalizedCreator,
    tierId,
    subscriber,
    chain,
    status: 'pending',
    startDate: now,
    expiryDate,
    amount,
    method,
    nonce,
    createdAt: now,
  };

  try {
    // Store subscription record
    await env.SUBSCRIPTIONS?.put(
      subKey(normalizedCreator, subscriber),
      JSON.stringify(subscription),
      {
        expirationTtl: NONCE_TTL_SEC,
      },
    );

    // Store nonce
    await env.CACHE?.put(
      nonceKey(normalizedCreator, subscriber),
      JSON.stringify({ nonce, amount, tierId }),
      {
        expirationTtl: NONCE_TTL_SEC,
      },
    );

    // Add to subscriber index
    const subsRaw = await env.SUBSCRIPTIONS?.get(subscribersKey(normalizedCreator));
    const subsList: string[] = subsRaw ? JSON.parse(subsRaw) : [];
    if (!subsList.includes(subscriber)) {
      subsList.push(subscriber);
      await env.SUBSCRIPTIONS?.put(
        subscribersKey(normalizedCreator),
        JSON.stringify(subsList.slice(-MAX_SUBSCRIBERS)),
        {
          expirationTtl: SUB_TTL_SEC,
        },
      );
    }

    return noCacheJsonResponse({
      success: true,
      status: 'pending',
      subscriptionId: subscription.id,
      paymentIntent: {
        to: creator,
        amount,
        chain,
        nonce,
        tierName: tier.name,
      },
      instructions: 'Complete payment and POST to /api/subscription-nft/confirm with txHash',
      nonce,
    });
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }
}

// ─── Subscriber: POST /api/subscription-nft/confirm — Confirm subscription ─

interface ConfirmBody {
  creator?: string;
  tierId?: string;
  txHash?: string;
  nonce?: string;
  tokenId?: string;
  nftContract?: string;
}

export async function handleSubscriptionNftConfirm(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const creator = sanitizeString(body.creator, 128);
  const tierId = sanitizeString(body.tierId, 64);
  const txHash = sanitizeString(body.txHash, 256);
  const providedNonce = sanitizeString(body.nonce, 64);
  const tokenId = sanitizeString(body.tokenId, 128);
  const nftContract = sanitizeString(body.nftContract, 128);

  if (!creator || !txHash) {
    return jsonResponse({ error: 'creator and txHash required' }, 400);
  }

  const normalizedCreator = creator.toLowerCase();

  // Dedup txHash
  try {
    const existingTx = await env.SUBSCRIPTIONS?.get(txKey(txHash));
    if (existingTx) {
      return jsonResponse({ error: 'Transaction already used' }, 409);
    }
  } catch {
    // Continue
  }

  const subscriber = session.address.toLowerCase();
  const subRecordKey = subKey(normalizedCreator, subscriber);

  let subscription: NftSubscription;
  try {
    const raw = await env.SUBSCRIPTIONS?.get(subRecordKey);
    if (!raw) {
      return jsonResponse({ error: 'No pending subscription found' }, 404);
    }
    subscription = JSON.parse(raw) as NftSubscription;
  } catch {
    return jsonResponse({ error: 'No pending subscription found' }, 404);
  }

  if (subscription.status !== 'pending') {
    return jsonResponse({ error: 'Subscription is not pending' }, 409);
  }

  // Verify nonce
  if (providedNonce && providedNonce !== subscription.nonce) {
    return jsonResponse({ error: 'Invalid nonce' }, 400);
  }

  // Verify nonce in cache
  try {
    const nonceRaw = await env.CACHE?.get(nonceKey(normalizedCreator, subscriber));
    if (nonceRaw) {
      const nonceRecord = JSON.parse(nonceRaw) as { nonce: string };
      if (nonceRecord.nonce !== subscription.nonce) {
        return jsonResponse({ error: 'Nonce mismatch' }, 400);
      }
    }
  } catch {
    // Continue
  }

  // Activate the subscription
  const now = nowUnix();
  subscription.status = 'active';
  subscription.txHash = txHash;
  subscription.nonce = '';

  if (tokenId) subscription.tokenId = tokenId;
  if (nftContract) subscription.nftContract = nftContract;

  const expiryDate = subscription.expiryDate || now + 30 * 24 * 60 * 60 * 1000;

  try {
    // Update subscription record
    await env.SUBSCRIPTIONS?.put(subRecordKey, JSON.stringify(subscription), {
      expirationTtl: SUB_TTL_SEC,
    });

    // Mark txHash as used
    await env.SUBSCRIPTIONS?.put(
      txKey(txHash),
      JSON.stringify({ usedAt: now, creator: normalizedCreator, subscriber }),
      {
        expirationTtl: TX_DEDUP_TTL_SEC,
      },
    );

    // Delete nonce
    await env.CACHE?.delete(nonceKey(normalizedCreator, subscriber));

    // Add to user's active subscriptions
    const activeRaw = await env.CACHE?.get(activeSubsKey(subscriber));
    const activeList: string[] = activeRaw ? JSON.parse(activeRaw) : [];
    if (!activeList.includes(normalizedCreator)) {
      activeList.push(normalizedCreator);
      await env.CACHE?.put(activeSubsKey(subscriber), JSON.stringify(activeList), {
        expirationTtl: SUB_TTL_SEC,
      });
    }

    // Increment subscriber count on tier
    try {
      const tierRaw = await env.SUBSCRIPTIONS?.get(
        tierKey(normalizedCreator, tierId || subscription.tierId),
      );
      if (tierRaw) {
        const tier = JSON.parse(tierRaw) as SubscriptionTier;
        tier.subscriberCount = (tier.subscriberCount || 0) + 1;
        await env.SUBSCRIPTIONS?.put(
          tierKey(normalizedCreator, tierId || subscription.tierId),
          JSON.stringify(tier),
          {
            expirationTtl: SUB_TTL_SEC,
          },
        );
      }
    } catch {
      // Non-fatal
    }

    return noCacheJsonResponse({
      success: true,
      subscription: {
        ...subscription,
        status: 'active',
        expiryDate,
      },
    });
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }
}

// ─── Subscriber: GET /api/subscription-nft/active — List active subs ──────

export async function handleSubscriptionNftActive(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const subscriber = session.address.toLowerCase();

  try {
    const activeRaw = await env.CACHE?.get(activeSubsKey(subscriber));
    const creatorList: string[] = activeRaw ? JSON.parse(activeRaw) : [];

    if (creatorList.length === 0) {
      return jsonResponse({ subscriptions: [] });
    }

    const now = nowUnix();
    const subscriptions: Array<NftSubscription & { tier?: SubscriptionTier }> = [];

    for (const creator of creatorList) {
      try {
        const subRaw = await env.SUBSCRIPTIONS?.get(subKey(creator, subscriber));
        if (subRaw) {
          const sub = JSON.parse(subRaw) as NftSubscription;
          const isExpired = sub.expiryDate > 0 && sub.expiryDate < now;

          if (sub.status === 'active' && !isExpired) {
            // Fetch tier details
            let tier: SubscriptionTier | undefined;
            try {
              const tierRaw = await env.SUBSCRIPTIONS?.get(tierKey(creator, sub.tierId));
              if (tierRaw) tier = JSON.parse(tierRaw) as SubscriptionTier;
            } catch {
              // Continue
            }

            subscriptions.push({ ...sub, tier });
          }
        }
      } catch {
        // Skip failed
      }
    }

    return jsonResponse({
      subscriptions,
      count: subscriptions.length,
    });
  } catch {
    return jsonResponse({ error: 'Failed to retrieve subscriptions' }, 500);
  }
}

// ─── Subscriber: POST /api/subscription-nft/cancel — Cancel subscription ──

interface CancelBody {
  creator?: string;
}

export async function handleSubscriptionNftCancel(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: CancelBody;
  try {
    body = (await request.json()) as CancelBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const creator = sanitizeString(body.creator, 128);
  if (!creator) {
    return jsonResponse({ error: 'creator required' }, 400);
  }

  const normalizedCreator = creator.toLowerCase();
  const subscriber = session.address.toLowerCase();
  const subRecordKey = subKey(normalizedCreator, subscriber);

  try {
    const raw = await env.SUBSCRIPTIONS?.get(subRecordKey);
    if (!raw) {
      return jsonResponse({ error: 'No subscription found' }, 404);
    }

    const subscription = JSON.parse(raw) as NftSubscription;
    if (subscription.status === 'cancelled') {
      return jsonResponse({ error: 'Already cancelled' }, 409);
    }

    subscription.status = 'cancelled';

    await env.SUBSCRIPTIONS?.put(subRecordKey, JSON.stringify(subscription), {
      expirationTtl: SUB_TTL_SEC,
    });

    // Remove from active subscriptions list
    try {
      const activeRaw = await env.CACHE?.get(activeSubsKey(subscriber));
      if (activeRaw) {
        const activeList: string[] = JSON.parse(activeRaw);
        const filtered = activeList.filter((c) => c !== normalizedCreator);
        await env.CACHE?.put(activeSubsKey(subscriber), JSON.stringify(filtered), {
          expirationTtl: SUB_TTL_SEC,
        });
      }
    } catch {
      // Non-fatal
    }

    return noCacheJsonResponse({ success: true, status: 'cancelled' });
  } catch {
    return jsonResponse({ error: 'Failed to cancel subscription' }, 500);
  }
}

// ─── Check: GET /api/subscription-nft/check — Check access for content ────

export async function handleSubscriptionNftCheck(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const creator = sanitizeString(url.searchParams.get('creator'), 128);
  const requiredTier = sanitizeString(url.searchParams.get('tierId'), 64);

  if (!creator) {
    return jsonResponse({ error: 'creator query parameter required' }, 400);
  }

  const normalizedCreator = creator.toLowerCase();
  const subscriber = session.address.toLowerCase();

  try {
    const raw = await env.SUBSCRIPTIONS?.get(subKey(normalizedCreator, subscriber));
    if (!raw) {
      return jsonResponse({ hasAccess: false, reason: 'No subscription found' });
    }

    const subscription = JSON.parse(raw) as NftSubscription;
    const now = nowUnix();

    if (subscription.status !== 'active') {
      return jsonResponse({ hasAccess: false, reason: 'Subscription not active' });
    }

    if (subscription.expiryDate > 0 && subscription.expiryDate < now) {
      return jsonResponse({ hasAccess: false, reason: 'Subscription expired' });
    }

    // If a specific tier is required, check that
    if (requiredTier && subscription.tierId !== requiredTier) {
      return jsonResponse({
        hasAccess: false,
        reason: `Requires tier: ${requiredTier}`,
        currentTier: subscription.tierId,
      });
    }

    return jsonResponse({
      hasAccess: true,
      subscription: {
        tierId: subscription.tierId,
        expiryDate: subscription.expiryDate,
        tokenId: subscription.tokenId,
        nftContract: subscription.nftContract,
      },
    });
  } catch {
    return jsonResponse({ error: 'Failed to check subscription' }, 500);
  }
}

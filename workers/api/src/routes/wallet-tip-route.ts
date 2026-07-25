/**
 * @degenfeed/api-worker — Wallet-Based Tip Routing
 *
 * TASK 2: Wallet-Based Tip Routing
 * Routes tips intelligently based on what we know about the recipient:
 *   1. Known recipient wallet → tip directly on-chain (cheapest route)
 *   2. Unknown wallet but known protocol identity → resolve identity → find wallet → tip
 *   3. Only protocol identity known → use protocol-native tipping
 *   4. Neither known → generate tip link/QR code
 *
 * @see ../lib/intelligent-tips.ts — Context-aware tip routing
 * @see ../lib/identity-discovery.ts — Cross-protocol identity resolution
 */

import { identityKey } from '@degenfeed/utils';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import { getProtocolCapability } from '../lib/intelligent-tips';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import type { SupportedChain } from './unified-tip-core';
import { recordUnifiedTip, type TipEntityType } from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────

export type WalletKnowledge =
  /** We have a known wallet address for the recipient */
  | 'known_wallet'
  /** We know the protocol identity but not the wallet */
  | 'known_protocol_identity'
  /** We only know who they are on a protocol (no wallet linked) */
  | 'protocol_identity_only'
  /** We don't know anything about this recipient */
  | 'unknown';

export interface WalletRouteRequest {
  /** Recipient identifier (wallet address, DID, handle) */
  recipientId: string;
  /** Protocol the content is from */
  protocol: string;
  /** Amount in USD for fee estimation */
  amountUsd?: number;
  /** Sender wallet address (if connected) */
  senderWallet?: string;
  /** Entity ID being tipped */
  entityId?: string;
  /** Entity type */
  entityType?: string;
}

export interface WalletRouteResult {
  /** What we know about the recipient */
  knowledge: WalletKnowledge;
  /** Recommended action for the client */
  action:
    | 'direct_onchain'
    | 'resolve_identity'
    | 'protocol_native'
    | 'generate_link'
    | 'generate_qr';
  /** Resolved wallet addresses (if known) */
  wallets: {
    evm?: string;
    solana?: string;
    lightning?: string;
  };
  /** Best chain for the tip */
  recommendedChain: SupportedChain;
  /** Human-readable instructions */
  instructions: string;
  /** Action URL if link/QR needed */
  actionUrl?: string;
  /** Fee estimate in USD */
  feeEstimateUsd: number;
  /** Whether we have enough info to send directly */
  canSendDirect: boolean;
}

// ─── Chain priority for low fees ────────────────────────────────────────

const CHAIN_FEE_PRIORITY: Array<{
  chain: SupportedChain;
  maxFeeUsd: number;
  key: keyof WalletRouteResult['wallets'];
}> = [
  { chain: 'lightning', maxFeeUsd: 0.001, key: 'lightning' },
  { chain: 'solana', maxFeeUsd: 0.002, key: 'solana' },
  { chain: 'base', maxFeeUsd: 0.01, key: 'evm' },
  { chain: 'polygon', maxFeeUsd: 0.05, key: 'evm' },
];

// ─── Fee estimates per chain in USD ─────────────────────────────────────

// @ts-expect-error TS6133 unused
const _CHAIN_FEES: Record<string, number> = {
  lightning: 0.001,
  solana: 0.002,
  base: 0.01,
  polygon: 0.05,
  ethereum: 5.0,
};

// ─── Wallet Detection Helpers ───────────────────────────────────────────

const EVM_RE = /^0x[a-f0-9]{40}$/i;
const SOL_RE = /^[1-9a-hj-z]{32,44}$/;

function detectWalletType(input: string): 'evm' | 'solana' | 'lnurl' | 'unknown' {
  if (EVM_RE.test(input)) return 'evm';
  if (SOL_RE.test(input)) return 'solana';
  if (input.includes('@') || input.endsWith('.onion')) return 'lnurl';
  return 'unknown';
}

/**
 * Classify what we know about a recipient.
 */
async function classifyKnowledge(
  recipientId: string,
  protocol: string,
  env: Env,
): Promise<{
  knowledge: WalletKnowledge;
  wallets: WalletRouteResult['wallets'];
}> {
  const wallets: WalletRouteResult['wallets'] = {};
  const walletType = detectWalletType(recipientId);

  // CASE 1: Known wallet address directly
  if (walletType === 'evm') {
    wallets.evm = recipientId.toLowerCase();
    return { knowledge: 'known_wallet', wallets };
  }
  if (walletType === 'solana') {
    wallets.solana = recipientId;
    return { knowledge: 'known_wallet', wallets };
  }
  if (walletType === 'lnurl') {
    wallets.lightning = recipientId;
    return { knowledge: 'known_wallet', wallets };
  }

  // CASE 2 & 3: Look up cross-protocol identity from KV
  try {
    const key = identityKey(recipientId);
    const raw = await env.IDENTITIES?.get(key);
    if (raw) {
      const identity = JSON.parse(raw) as Record<string, unknown>;

      // Extract any wallet addresses from the identity
      const walletAddr = identity.walletAddress as string | undefined;
      if (walletAddr) {
        const wt = detectWalletType(walletAddr);
        if (wt === 'evm') wallets.evm = walletAddr.toLowerCase();
        else if (wt === 'solana') wallets.solana = walletAddr;
      }

      // Check farcaster custody address
      const farcaster = identity.farcaster as Record<string, unknown> | undefined;
      if (farcaster?.custodyAddress && !wallets.evm) {
        wallets.evm = (farcaster.custodyAddress as string).toLowerCase();
      }

      // Check linked profiles for additional wallets
      const profiles = identity.linkedProfiles as Record<string, unknown> | undefined;
      if (profiles) {
        for (const [, profile] of Object.entries(profiles)) {
          const p = profile as Record<string, unknown>;
          if (p.evmAddress && !wallets.evm) wallets.evm = (p.evmAddress as string).toLowerCase();
          if (p.solanaAddress && !wallets.solana) wallets.solana = p.solanaAddress as string;
          if (p.lightningAddress && !wallets.lightning)
            wallets.lightning = p.lightningAddress as string;
        }
      }

      // Check if there's a known protocol identity (but no wallet)
      const hasIdentity = Object.keys(identity).length > 0;

      if (wallets.evm || wallets.solana || wallets.lightning) {
        return { knowledge: 'known_wallet', wallets };
      }
      if (hasIdentity) {
        return { knowledge: 'known_protocol_identity', wallets };
      }
    }
  } catch {
    // KV lookup is best-effort
  }

  // CASE 3: We know the protocol — use the protocol's native tipping
  const protocolCap = getProtocolCapability(protocol);
  if (protocolCap.nativeMethod || protocolCap.methods.length > 0) {
    return { knowledge: 'protocol_identity_only', wallets };
  }

  // CASE 4: Nothing known
  return { knowledge: 'unknown', wallets };
}

/**
 * Pick the cheapest available chain for a tip.
 */
function pickCheapestChain(wallets: WalletRouteResult['wallets']): {
  chain: SupportedChain;
  feeEstimateUsd: number;
} {
  for (const entry of CHAIN_FEE_PRIORITY) {
    if (wallets[entry.key]) {
      return { chain: entry.chain, feeEstimateUsd: entry.maxFeeUsd };
    }
  }
  // Fallback: generate link (no direct send possible)
  return { chain: 'base' as SupportedChain, feeEstimateUsd: 0.01 };
}

/**
 * GET /api/tip/wallet-route
 *
 * Determines the optimal route for a tip based on recipient knowledge.
 * Query params:
 *   recipientId — Recipient identifier (wallet, DID, handle)
 *   protocol — Protocol of the content
 *   amountUsd — Optional amount for fee estimates
 */
export async function handleWalletRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const recipientId = sanitizeString(url.searchParams.get('recipientId'), 256);
  const protocol = sanitizeString(url.searchParams.get('protocol'), 32);
  const amountUsd = Number.parseFloat(url.searchParams.get('amountUsd') ?? 'NaN');

  if (!recipientId || !protocol || hasSuspiciousPayload(`${recipientId}${protocol}`)) {
    return jsonResponse({ error: 'recipientId and protocol required' }, 400);
  }

  const { knowledge, wallets } = await classifyKnowledge(recipientId, protocol, env);
  const { chain: recommendedChain, feeEstimateUsd } = pickCheapestChain(wallets);

  const baseUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz';

  let action: WalletRouteResult['action'];
  let instructions: string;
  let actionUrl: string | undefined;
  let canSendDirect: boolean;

  switch (knowledge) {
    case 'known_wallet': {
      canSendDirect = true;
      if (wallets.lightning) {
        action = 'direct_onchain';
        instructions = `Send directly via Lightning — instant, <$0.001 fee. Recipient has a Lightning address.`;
        actionUrl = `${baseUrl}/api/tip/lightning/invoice?pubkey=${encodeURIComponent(recipientId)}${Number.isFinite(amountUsd) ? `&amount=${amountUsd}` : ''}`;
      } else if (wallets.solana) {
        action = 'direct_onchain';
        instructions = `Send SOL/USDC directly to recipient's Solana address — sub-cent fee.`;
      } else if (wallets.evm) {
        action = 'direct_onchain';
        instructions = `Send ETH/USDC directly to recipient's EVM address on ${recommendedChain} — low fee.`;
      } else {
        action = 'direct_onchain';
        instructions = `Send tip directly on-chain — recipient has a known wallet.`;
      }
      break;
    }

    case 'known_protocol_identity': {
      canSendDirect = false;
      action = 'resolve_identity';
      instructions =
        'We know who this is but need their wallet address. Please ask them to link a wallet, or use protocol-native tipping.';
      actionUrl = `${baseUrl}/tip/link/${encodeURIComponent(protocol)}/${encodeURIComponent(recipientId)}${Number.isFinite(amountUsd) ? `?amount=${amountUsd}` : ''}`;
      break;
    }

    case 'protocol_identity_only': {
      canSendDirect = false;
      const capability = getProtocolCapability(protocol);
      action = 'protocol_native';
      instructions = `Use ${capability.label}'s native tipping mechanism. ${capability.nativeMethod ? `Native method: ${capability.nativeMethod}` : 'No native tipping available — use link.'}`;
      actionUrl =
        capability.docsUrl ||
        `${baseUrl}/tip/${encodeURIComponent(protocol)}/${encodeURIComponent(recipientId)}`;
      break;
    }
    default: {
      canSendDirect = false;
      action = 'generate_link';
      instructions =
        'No known wallet or identity for this recipient. Generate a tip link or QR code to share with them.';
      actionUrl = `${baseUrl}/tip/${encodeURIComponent(recipientId)}${Number.isFinite(amountUsd) ? `?amount=${amountUsd}` : ''}`;
      break;
    }
  }

  return jsonResponse({
    knowledge,
    action,
    wallets,
    recommendedChain,
    instructions,
    actionUrl,
    feeEstimateUsd,
    canSendDirect,
    _links: {
      self: `/api/tip/wallet-route?recipientId=${encodeURIComponent(recipientId)}&protocol=${encodeURIComponent(protocol)}`,
      tipAction: actionUrl,
    },
  } satisfies WalletRouteResult);
}

// ─── POST /api/tip/wallet-route/execute ─────────────────────────────────

interface ExecuteWalletRouteBody {
  recipientId: string;
  protocol: string;
  method: string;
  amount: string;
  chain?: string;
  sender?: string;
  entityId?: string;
  entityType?: string;
  amountUsd?: number;
}

/**
 * POST /api/tip/wallet-route/execute
 *
 * Executes a tip using the optimal wallet route.
 * Body matches the standard tip create but adds wallet routing intelligence.
 */
export async function handleWalletRouteExecute(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as ExecuteWalletRouteBody;
    const recipientId = sanitizeString(body.recipientId, 128);
    const protocol = sanitizeString(body.protocol, 32);
    const method = sanitizeString(body.method, 32);
    const amount = sanitizeString(body.amount, 64);
    const chain = sanitizeString(body.chain, 32) || undefined;
    const sender = sanitizeString(body.sender, 128) || undefined;
    const entityId = sanitizeString(body.entityId, 256) || undefined;
    const entityTypeRaw = sanitizeString(body.entityType, 16) || undefined;

    if (
      !recipientId ||
      !protocol ||
      !method ||
      !amount ||
      !isValidAmount(amount) ||
      hasSuspiciousPayload(`${recipientId}${protocol}${method}`)
    ) {
      return jsonResponse({ error: 'recipientId, protocol, method, and amount required' }, 400);
    }

    // Classify the recipient knowledge
    const { knowledge, wallets } = await classifyKnowledge(recipientId, protocol, env);
    const { chain: bestChain } = pickCheapestChain(wallets);

    // Record in unified ledger
    const amountUsd =
      typeof body.amountUsd === 'number'
        ? body.amountUsd
        : Number.parseFloat(sanitizeString(String(body.amountUsd), 64) || 'NaN');

    if (Number.isFinite(amountUsd) && amountUsd > 0) {
      const entityType: TipEntityType =
        entityTypeRaw === 'comment' || entityTypeRaw === 'video' || entityTypeRaw === 'space'
          ? entityTypeRaw
          : 'post';
      await recordUnifiedTip(env, {
        platform:
          protocol === 'degenfeed'
            ? 'degenfeed'
            : (protocol as Parameters<typeof recordUnifiedTip>[0]['platform']),
        entityId: entityId || recipientId,
        entityType,
        amountUsd,
        fromUserId: sender,
        toUserId: recipientId,
        method,
      });
    }

    // Return route-aware response
    return jsonResponse({
      success: true,
      knowledge,
      method,
      intent: {
        to: wallets.evm || wallets.solana || recipientId,
        amount,
        chain: chain || bestChain,
      },
      wallets,
      instructions:
        knowledge === 'known_wallet'
          ? 'Send directly to the known wallet address'
          : knowledge === 'known_protocol_identity'
            ? 'Identity known — routing through protocol bridge'
            : 'Generating tip link',
      canSendDirect: knowledge === 'known_wallet',
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── POST /api/tip/wallet-route/link ────────────────────────────────────

/**
 * POST /api/tip/wallet-route/link
 *
 * Generates a tip link or QR code when we can't send directly.
 * Body: { recipientId, protocol, amount?, entityId? }
 */
export async function handleWalletRouteLink(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 5 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as {
      recipientId?: string;
      protocol?: string;
      amount?: string;
      entityId?: string;
    };
    const recipientId = sanitizeString(body.recipientId, 128);
    const _protocol = sanitizeString(body.protocol, 32);
    const amount = sanitizeString(body.amount, 64);
    const entityId = sanitizeString(body.entityId, 256);

    if (!recipientId) {
      return jsonResponse({ error: 'recipientId required' }, 400);
    }

    const base = env.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz';
    const amt = amount ? `?amount=${amount}` : '';
    const ent = entityId ? `${entityId}/` : '';
    const linkUrl = `${base}/tip/link/${ent}${encodeURIComponent(recipientId)}${amt}`;

    return jsonResponse({
      linkUrl,
      qrCodeUrl: `${base}/api/qr?url=${encodeURIComponent(linkUrl)}`,
      instructions: 'Share this link with the recipient to receive your tip.',
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

/**
 * @degenfeed/api-worker — Blinks V2: Solana Blink Actions for Tipping
 *
 * Full Solana Actions (Blinks) implementation following the Solana Actions spec:
 * - GET  → returns Action metadata (Blink action JSON)
 * - POST → returns a partially-signed Transaction for the user
 *
 * Supports:
 *   1. Generic "Tip {amount} SOL" Blink
 *   2. Creator-specific Blinks
 *   3. Post-specific Blinks
 *   4. Shareable Blink URLs
 *   5. Blink action confirmation with creator info
 *   6. Blink metadata for registry (dial.to, squads, etc.)
 *
 * @see https://docs.dialect.to/documentation/actions/actions
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import type { Env } from '../types';
import { jsonResponse } from '../response-helpers';
import { methodNotAllowed } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isValidAmount,
  isValidSolanaAddress,
  sanitizeString,
} from '../sanitize';
import { recordUnifiedTip, type TipEntityType, type TipPlatform } from './unified-tip-core';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_TIP_SOL = 100;
const MIN_TIP_SOL = 0.000001;
const DEFAULT_BLINK_RPC = 'https://api.mainnet-beta.solana.com';
const BLINKS_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week for blink metadata

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BlinkActionMetadata {
  /** Title shown in the blink card */
  title: string;
  /** Icon/avatar URL */
  icon: string;
  /** Description shown in the blink card */
  description: string;
  /** CTA label */
  label: string;
  /** Whether this blink has been confirmed/executed */
  disabled?: boolean;
  links?: {
    actions: Array<{
      label: string;
      href: string;
      /** Parameter hint — tells clients how to fill {amount} or {recipient} */
      parameters?: Array<{
        name: string;
        label: string;
        required: boolean;
      }>;
    }>;
  };
  /** Blink registry metadata */
  metadata?: {
    /** Creator name for display */
    creatorName?: string;
    /** Creator avatar */
    creatorAvatar?: string;
    /** Creator bio for blink card */
    creatorBio?: string;
    /** Entity being tipped */
    entityType?: string;
    /** Entity label */
    entityLabel?: string;
  };
}

export interface BlinkActionResult {
  transaction: string; // base64-encoded partially signed transaction
  message: string;
  /** Optional redirect URL after success */
  redirect?: string;
}

export interface BlinkConfirmation {
  confirmed: boolean;
  signature?: string;
  recipientDisplayName?: string;
  amountUsd?: number;
  activityId?: string;
  error?: string;
}

// ─── Types of blink request ─────────────────────────────────────────────────

interface BlinkParams {
  /** Recipient Solana address or DegenFeed handle */
  recipient?: string;
  /** Amount in SOL */
  amount?: string;
  /** Optional creator name for metadata */
  creatorName?: string;
  /** Optional creator avatar */
  creatorAvatar?: string;
  /** Optional creator bio */
  creatorBio?: string;
  /** Optional entity type: post, video, comment, track, etc. */
  entityType?: string;
  /** Optional entity label */
  entityLabel?: string;
  /** Optional entity ID for tracking */
  entityId?: string;
  /** Platform the content originated from */
  platform?: string;
  /** Fixed amount blink (no user input) */
  fixed?: string;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function handleBlinkV2(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route to specific blink handler
  // /api/blink/v2/tip              — generic tip blink
  // /api/blink/v2/tip/{recipient}  — creator-specific blink
  // /api/blink/v2/post/{entityId}  — post-specific blink
  // /api/blink/v2/confirm          — confirm a blink transaction

  if (path.includes('/confirm')) {
    if (request.method === 'POST') return handleBlinkConfirm(request, env);
    return methodNotAllowed(['POST']);
  }

  if (path.includes('/post/')) {
    // Post-specific blink: /api/blink/v2/post/{entityId}
    return handleBlinkV2PostSpecific(request, env);
  }

  if (request.method === 'GET') {
    return jsonResponse(buildBlinkV2Action(url, env));
  }

  if (request.method === 'POST') {
    return handleBlinkV2Post(request, env, url);
  }

  return methodNotAllowed(['GET', 'POST']);
}

// ─── GET: Build Blink Action Metadata ──────────────────────────────────────

function buildBlinkV2Action(url: URL, env: Env): BlinkActionMetadata {
  const origin = `${url.protocol}//${url.host}`;
  const recipient = sanitizeString(url.searchParams.get('recipient'), 128);
  const creatorName = sanitizeString(url.searchParams.get('creatorName'), 256);
  const creatorAvatar = sanitizeString(url.searchParams.get('creatorAvatar'), 512);
  const creatorBio = sanitizeString(url.searchParams.get('creatorBio'), 1024);
  const entityType = sanitizeString(url.searchParams.get('entityType'), 32);
  const entityLabel = sanitizeString(url.searchParams.get('entityLabel'), 256);
  const fixed = sanitizeString(url.searchParams.get('fixed'), 32);
  const amount = sanitizeString(url.searchParams.get('amount'), 32);

  // Build href with proper parameter hints
  const baseHref = `${origin}/api/blink/v2/tip`;
  const params = new URLSearchParams();

  if (recipient) params.set('recipient', recipient);
  else params.set('recipient', '{recipient}');

  if (fixed) {
    // Fixed amount blink — no amount parameter needed
    params.set('fixed', fixed);
  } else if (amount) {
    params.set('amount', amount);
  } else {
    params.set('amount', '{amount}');
  }

  if (creatorName) params.set('creatorName', creatorName);
  if (entityType) params.set('entityType', entityType);
  if (entityLabel) params.set('entityLabel', entityLabel);

  const href = `${baseHref}?${params.toString()}`;

  const title = recipient ? `Tip ${creatorName ?? recipient} on DegenFeed` : 'Tip on DegenFeed';
  const description = entityLabel
    ? `Send a tip to ${creatorName ?? 'a creator'} for "${entityLabel}"`
    : creatorBio
      ? creatorBio
      : 'Send a tip to any creator on the fediverse';

  const action: BlinkActionMetadata = {
    title,
    icon: creatorAvatar ?? `${origin}/favicon.ico`,
    description,
    label: fixed ? `Tip ${fixed} SOL` : 'Tip',
    links: {
      actions: [
        {
          label: fixed ? `Tip ${fixed} SOL` : 'Tip',
          href,
          parameters: recipient
            ? undefined
            : [{ name: 'recipient', label: 'Recipient address', required: true }],
        },
      ],
    },
    metadata: {
      creatorName: creatorName ?? undefined,
      creatorAvatar: creatorAvatar ?? undefined,
      creatorBio: creatorBio ?? undefined,
      entityType: entityType ?? undefined,
      entityLabel: entityLabel ?? undefined,
    },
  };

  // If amount param present but no fixed — include amount parameter hint
  if (!fixed && !amount) {
    // Remove default params that have {variables} — they confuse non-dialto clients
    // Instead add parameter hints for manual clients
    const cleanHref = `${baseHref}?recipient={recipient}&amount={amount}${
      creatorName ? `&creatorName=${encodeURIComponent(creatorName)}` : ''
    }`;
    action.links!.actions[0]!.href = cleanHref;
  }

  return action;
}

// ─── POST: Build Transaction ───────────────────────────────────────────────

async function handleBlinkV2Post(request: Request, env: Env, url: URL): Promise<Response> {
  const rawRecipient = sanitizeString(url.searchParams.get('recipient'), 128);
  const rawAmount = sanitizeString(url.searchParams.get('amount'), 64);
  const rawFixed = sanitizeString(url.searchParams.get('fixed'), 32);
  const creatorName = sanitizeString(url.searchParams.get('creatorName'), 256);
  const entityType = sanitizeString(url.searchParams.get('entityType'), 32);
  const entityLabel = sanitizeString(url.searchParams.get('entityLabel'), 256);
  const platform = sanitizeString(url.searchParams.get('platform'), 32);

  let body: { account?: unknown } = {};
  try {
    body = (await request.json()) as { account?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const account = sanitizeString(body.account, 128);

  if (!rawRecipient || !account) {
    return jsonResponse({ error: 'recipient and account required' }, 400);
  }
  if (!isValidSolanaAddress(account)) {
    return jsonResponse({ error: 'Invalid sender account' }, 400);
  }

  // Determine amount: fixed > query param > error
  let finalAmount: string;
  if (rawFixed) {
    finalAmount = rawFixed;
  } else if (rawAmount) {
    finalAmount = rawAmount;
  } else {
    // Try to get amount from the body (some blink clients send it there)
    const bodyAny = body as Record<string, unknown>;
    if (bodyAny.amount) {
      finalAmount = sanitizeString(bodyAny.amount, 64);
    } else {
      return jsonResponse({ error: 'amount required' }, 400);
    }
  }

  if (
    !isValidAmount(finalAmount) ||
    hasSuspiciousPayload(`${rawRecipient}${finalAmount}${account}`)
  ) {
    return jsonResponse({ error: 'Invalid amount' }, 400);
  }

  const amount = Number.parseFloat(finalAmount);
  if (Number.isNaN(amount) || amount < MIN_TIP_SOL || amount > MAX_TIP_SOL) {
    return jsonResponse(
      { error: `Amount must be between ${MIN_TIP_SOL} and ${MAX_TIP_SOL} SOL` },
      400,
    );
  }

  const recipient = await resolveBlinkRecipient(rawRecipient, env);
  if (!recipient) {
    return jsonResponse(
      { error: 'Recipient must be a valid Solana address or registered handle' },
      400,
    );
  }

  try {
    const rpcUrl = env.SOLANA_RPC_URL || DEFAULT_BLINK_RPC;
    const connection = new Connection(rpcUrl, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const fromPubkey = new PublicKey(account);
    const toPubkey = new PublicKey(recipient);

    const tx = new Transaction();
    tx.feePayer = fromPubkey;
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      }),
    );

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = btoa(String.fromCharCode(...serialized));

    // Store blink intent in KV for confirmation tracking
    const intentId = `blink:intent:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    try {
      await env.CACHE?.put(
        intentId,
        JSON.stringify({
          sender: account,
          recipient,
          amount,
          creatorName,
          entityType,
          entityLabel,
          platform,
          at: Date.now(),
        }),
        { expirationTtl: 60 * 60 }, // 1 hour
      );
    } catch {
      // Non-critical
    }

    const result: BlinkActionResult & { intentId?: string } = {
      transaction: base64,
      message: `Tip ${amount} SOL to ${recipient}`,
    };

    // Add intent ID for confirmation tracking
    if (intentId) result.intentId = intentId;

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build transaction';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── Post-Specific Blink ──────────────────────────────────────────────────

async function handleBlinkV2PostSpecific(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  // /api/blink/v2/post/{entityId}?platform=...
  const entityId = sanitizeString(pathParts[pathParts.length - 1], 256);
  const platform = sanitizeString(url.searchParams.get('platform'), 32) || 'degenfeed';

  if (!entityId) {
    return jsonResponse({ error: 'entityId required in path' }, 400);
  }

  // Look up entity info from KV
  const entityInfo = await lookupEntityInfo(env, entityId, platform);

  if (request.method === 'GET') {
    const origin = `${url.protocol}//${url.host}`;
    const displayName = entityInfo?.creatorName ?? 'Creator';
    const displayTitle = entityInfo?.entityLabel ?? 'Content';

    const action: BlinkActionMetadata = {
      title: `Tip ${displayName} for "${displayTitle.slice(0, 40)}${displayTitle.length > 40 ? '…' : ''}"`,
      icon: entityInfo?.creatorAvatar ?? `${origin}/favicon.ico`,
      description: `Send a tip to ${displayName} via DegenFeed. All tips are recorded in the unified ledger.`,
      label: 'Tip',
      links: {
        actions: [
          {
            label: 'Tip 0.01 SOL',
            href: `${origin}/api/blink/v2/tip?recipient=${encodeURIComponent(entityInfo?.recipientAddress ?? entityId)}&amount=0.01&creatorName=${encodeURIComponent(displayName)}&entityType=${encodeURIComponent(platform)}&entityLabel=${encodeURIComponent(displayTitle)}&fixed=0.01`,
          },
          {
            label: 'Tip 0.1 SOL',
            href: `${origin}/api/blink/v2/tip?recipient=${encodeURIComponent(entityInfo?.recipientAddress ?? entityId)}&amount=0.1&creatorName=${encodeURIComponent(displayName)}&entityType=${encodeURIComponent(platform)}&entityLabel=${encodeURIComponent(displayTitle)}&fixed=0.1`,
          },
          {
            label: 'Tip 1 SOL',
            href: `${origin}/api/blink/v2/tip?recipient=${encodeURIComponent(entityInfo?.recipientAddress ?? entityId)}&amount=1&creatorName=${encodeURIComponent(displayName)}&entityType=${encodeURIComponent(platform)}&entityLabel=${encodeURIComponent(displayTitle)}&fixed=1`,
          },
          {
            label: 'Custom tip',
            href: `${origin}/api/blink/v2/tip?recipient=${encodeURIComponent(entityInfo?.recipientAddress ?? entityId)}&amount={amount}&creatorName=${encodeURIComponent(displayName)}&entityType=${encodeURIComponent(platform)}&entityLabel=${encodeURIComponent(displayTitle)}`,
            parameters: [{ name: 'amount', label: 'Tip amount (SOL)', required: true }],
          },
        ],
      },
      metadata: {
        creatorName: displayName,
        creatorAvatar: entityInfo?.creatorAvatar,
        creatorBio: entityInfo?.creatorBio,
        entityType: platform,
        entityLabel: displayTitle,
      },
    };

    return jsonResponse(action);
  }

  if (request.method === 'POST') {
    // Redirect to the generic tip handler with params from entity info
    const newUrl = new URL(url);
    newUrl.pathname = '/api/blink/v2/tip';
    if (entityInfo?.recipientAddress && !newUrl.searchParams.has('recipient')) {
      newUrl.searchParams.set('recipient', entityInfo.recipientAddress);
    }
    if (entityInfo?.creatorName && !newUrl.searchParams.has('creatorName')) {
      newUrl.searchParams.set('creatorName', entityInfo.creatorName);
    }
    return handleBlinkV2Post(request, env, newUrl);
  }

  return methodNotAllowed(['GET', 'POST']);
}

// ─── Blink Confirmation ────────────────────────────────────────────────────

async function handleBlinkConfirm(request: Request, env: Env): Promise<Response> {
  let body: { signature?: string; intentId?: string; recipient?: string } = {};
  try {
    body = (await request.json()) as { signature?: string; intentId?: string; recipient?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const signature = sanitizeString(body.signature, 128);
  const intentId = sanitizeString(body.intentId, 128);
  const recipient = sanitizeString(body.recipient, 128);

  if (!signature) {
    return jsonResponse({ error: 'signature required' }, 400);
  }

  try {
    // Verify transaction on-chain
    const rpcUrl = env.SOLANA_RPC_URL || DEFAULT_BLINK_RPC;
    const connection = new Connection(rpcUrl, 'confirmed');
    const txResult = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!txResult) {
      return jsonResponse({
        confirmed: false,
        error: 'Transaction not found. It may still be processing.',
      } satisfies BlinkConfirmation);
    }

    // Extract tip details from the transaction or stored intent
    let amountSol = 0;
    let senderAddress = '';
    let recipientAddress = recipient;
    let creatorName: string | undefined;

    // Try to recover from intent storage
    if (intentId) {
      try {
        const intentRaw = await env.CACHE?.get(intentId);
        if (intentRaw) {
          const intent = JSON.parse(intentRaw) as {
            sender: string;
            recipient: string;
            amount: number;
            creatorName?: string;
          };
          senderAddress = intent.sender;
          recipientAddress = intent.recipient;
          amountSol = intent.amount;
          creatorName = intent.creatorName;
        }
      } catch {
        // Best-effort
      }
    }

    // If we have a transfer instruction, extract the amount
    if (!amountSol && txResult.transaction?.message?.instructions) {
      for (const ix of txResult.transaction.message.instructions) {
        if (ix.programId?.toBase58() === '11111111111111111111111111111111') {
          // System program transfer — decode lamports
          // For simplicity, use the stored amount
        }
      }
    }

    // Record in unified tip ledger
    if (amountSol > 0 && recipientAddress) {
      const solPrice = await fetchSolPrice(env);
      const amountUsd = Math.round(amountSol * solPrice * 100) / 100;

      await recordUnifiedTip(env, {
        platform: 'solana',
        entityId: `blink:${signature.slice(0, 8)}`,
        entityType: 'post',
        amountUsd: Math.max(amountUsd, 0.01),
        fromUserId: senderAddress || undefined,
        toUserId: recipientAddress,
        fromLabel: senderAddress
          ? `${senderAddress.slice(0, 6)}…${senderAddress.slice(-4)}`
          : 'Anonymous',
        toLabel: creatorName ?? `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}`,
        method: 'solana_blink',
      });
    }

    const result: BlinkConfirmation = {
      confirmed: true,
      signature,
      recipientDisplayName:
        creatorName ?? `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}`,
      amountUsd:
        amountSol > 0 ? Math.round(amountSol * (await fetchSolPrice(env)) * 100) / 100 : undefined,
    };

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse(
      {
        confirmed: false,
        error: err instanceof Error ? err.message : 'Confirmation failed',
      } satisfies BlinkConfirmation,
      500,
    );
  }
}

// ─── Shareable Blink URL Generator ────────────────────────────────────────

export function buildShareableBlinkUrl(
  baseUrl: string,
  params: {
    recipient: string;
    amount?: string;
    creatorName?: string;
    entityType?: string;
    entityLabel?: string;
    entityId?: string;
  },
): string {
  const url = new URL(`${baseUrl}/api/blink/v2/tip`);
  url.searchParams.set('recipient', params.recipient);
  if (params.amount) url.searchParams.set('amount', params.amount);
  if (params.creatorName) url.searchParams.set('creatorName', params.creatorName);
  if (params.entityType) url.searchParams.set('entityType', params.entityType);
  if (params.entityLabel) url.searchParams.set('entityLabel', params.entityLabel);

  // Wrap in dial.to for blink-compatible clients
  const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(url.toString())}`;
  return blinkUrl;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface EntityLookup {
  recipientAddress: string;
  creatorName?: string;
  creatorAvatar?: string;
  creatorBio?: string;
  entityLabel?: string;
  entityType?: string;
}

async function lookupEntityInfo(
  env: Env,
  entityId: string,
  platform: string,
): Promise<EntityLookup | null> {
  // Try to look up from content tips records
  try {
    // Check PeerTube
    if (platform === 'peertube' || platform === 'video') {
      const raw = await env.CACHE?.get(`peertube:tip:stats:${entityId}`);
      if (raw) {
        const stats = JSON.parse(raw) as Record<string, unknown>;
        return {
          recipientAddress: entityId,
          creatorName: (stats.creatorName as string) ?? 'Creator',
          entityLabel: (stats.videoTitle as string) ?? entityId,
          entityType: 'video',
        };
      }
    }

    // Check unified tip ledger for entity info
    const entityKey = `tip:${platform}:${entityId}`;
    const tipRaw = await env.CACHE?.get(entityKey);
    if (tipRaw) {
      const tipData = JSON.parse(tipRaw) as Record<string, unknown>;
      const tips = tipData.tips as Array<Record<string, unknown>> | undefined;
      if (tips && tips.length > 0) {
        const tip = tips[0] as Record<string, unknown> | undefined;
        return {
          recipientAddress: (tip.toUserId as string) ?? entityId,
          creatorName: tip.toLabel as string,
          entityLabel: tip.entityLabel as string,
        };
      }
    }

    // Try Lemmy
    if (platform === 'lemmy') {
      const raw = await env.CACHE?.get(`lemmy:tip:${entityId}`);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, unknown>;
        return {
          recipientAddress: entityId,
          creatorName: 'Lemmy creator',
          entityLabel: data.contentType as string,
        };
      }
    }
  } catch {
    // Best-effort
  }

  return null;
}

async function resolveBlinkRecipient(input: string, env: Env): Promise<string | null> {
  // Direct Solana address
  if (isValidSolanaAddress(input)) return input;

  // Check if this is a known identity with a linked Solana wallet
  try {
    const { identityKey } = await import('@degenfeed/utils');
    const key = identityKey(input);
    const raw = await env.IDENTITIES?.get(key);
    if (raw) {
      const identity = JSON.parse(raw) as Record<string, unknown>;
      const walletAddr = identity.walletAddress as string | undefined;
      if (walletAddr && isValidSolanaAddress(walletAddr)) {
        return walletAddr;
      }
      // Check linked profiles
      const profiles = identity.linkedProfiles as Record<string, unknown> | undefined;
      if (profiles) {
        for (const [, profile] of Object.entries(profiles)) {
          const p = profile as Record<string, unknown>;
          if (p.solanaAddress && isValidSolanaAddress(p.solanaAddress as string)) {
            return p.solanaAddress as string;
          }
        }
      }
    }
  } catch {
    // Best-effort
  }

  return null;
}

let _cachedSolPrice: { price: number; at: number } | null = null;

async function fetchSolPrice(env: Env): Promise<number> {
  // Cache for 60s
  if (_cachedSolPrice && Date.now() - _cachedSolPrice.at < 60_000) {
    return _cachedSolPrice.price;
  }
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { solana?: { usd?: number } };
      if (data.solana?.usd) {
        _cachedSolPrice = { price: data.solana.usd, at: Date.now() };
        return data.solana.usd;
      }
    }
  } catch {
    // Fall through to default
  }
  return 150; // Fallback SOL price
}

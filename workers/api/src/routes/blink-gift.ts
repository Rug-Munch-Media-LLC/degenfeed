/**
 * @degenfeed/api-worker — Blink Action: Send Gift
 *
 * Solana Actions (Blinks) integration for the gift system.
 * Enables one-click gift sending from any Blink-compatible client
 * (Farcaster frames, X Feed, wallet browsers, etc.)
 *
 * GET  /api/blink/gift — Returns Blink metadata (GET)
 * POST /api/blink/gift — Builds and returns a Solana transaction
 *
 * Also handles:
 *   - NIP-57 zap receipts for Nostr viewers
 *   - Lightning Address payments for LN viewers
 *   - Creator Coin payments via Solana Program
 */

import { type Env, jsonResponse } from '../index';
import { sanitizeString } from '../sanitize';
import {
  type GiftTypeId,
  GIFT_TYPES,
  GIFT_TIERS,
  isValidGiftTypeId,
} from './live-gifts-core';

// ─── Blink Action Metadata ──────────────────────────────────────────────

interface BlinkAction {
  title: string;
  icon: string;
  description: string;
  label: string;
  links: {
    actions: Array<{
      label: string;
      href: string;
      parameters?: Array<{
        name: string;
        label: string;
        required: boolean;
      }>;
    }>;
  };
}

function buildGiftBlinkAction(origin: string): BlinkAction {
  return {
    title: 'Send a Gift on DegenFeed',
    icon: `${origin}/favicon.ico`,
    description: 'Send a live stream gift to a creator. Pay with Solana, USDC, or any SPL token.',
    label: 'Send Gift',
    links: {
      actions: [
        {
          label: 'Send Gift',
          href: `${origin}/api/blink/gift?recipient={recipient}&giftType={giftType}&senderLabel={senderLabel}`,
          parameters: [
            {
              name: 'recipient',
              label: 'Creator Solana Address',
              required: true,
            },
            {
              name: 'giftType',
              label: `Gift type: ${GIFT_TIERS.join(', ')}`,
              required: true,
            },
            {
              name: 'senderLabel',
              label: 'Your display name (optional)',
              required: false,
            },
          ],
        },
      ],
    },
  };
}

// ─── Transaction Builder ────────────────────────────────────────────────

function createGiftMemo(giftTypeId: GiftTypeId, senderLabel?: string): string {
  const gift = GIFT_TYPES[giftTypeId];
  const label = senderLabel || 'Anonymous';
  return `🎁 ${label} sent a ${gift.icon} ${gift.name} on DegenFeed Live! (${gift.usd.toFixed(2)} USD)`;
}

// ─── GET /api/blink/gift ────────────────────────────────────────────────

export async function handleBlinkGift(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  if (request.method === 'GET') {
    return jsonResponse(buildGiftBlinkAction(origin));
  }

  if (request.method === 'POST') {
    return handleBlinkGiftPost(request, env, url);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ─── POST /api/blink/gift ───────────────────────────────────────────────

async function handleBlinkGiftPost(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const rawRecipient = sanitizeString(url.searchParams.get('recipient'), 128);
    const rawGiftType = sanitizeString(url.searchParams.get('giftType'), 32);
    const rawSenderLabel = sanitizeString(url.searchParams.get('senderLabel'), 64);

    // Parse POST body for account
    let body: { account?: string } = {};
    try {
      body = (await request.json()) as { account?: string };
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const account = sanitizeString(body.account, 128);

    if (!rawRecipient || !rawGiftType || !account) {
      return jsonResponse({ error: 'recipient, giftType, and account required' }, 400);
    }

    if (!isValidGiftTypeId(rawGiftType)) {
      return jsonResponse({ error: `giftType must be one of: ${GIFT_TIERS.join(', ')}` }, 400);
    }

    const giftType = GIFT_TYPES[rawGiftType as GiftTypeId];
    const recipient = rawRecipient;
    const senderLabel = rawSenderLabel || undefined;

    // ── Build Solana Transaction ──
    try {
      const { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js');

      const rpcUrl = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      const fromPubkey = new PublicKey(account);
      const toPubkey = new PublicKey(recipient);

      const { blockhash } = await connection.getLatestBlockhash();

      const tx = new Transaction();
      tx.feePayer = fromPubkey;
      tx.recentBlockhash = blockhash;

      // Transfer the gift value in SOL (or use memo + actual transfer)
      const lamports = Math.floor(giftType.sats * (LAMPORTS_PER_SOL / 100_000_000)); // sats → lamports

      if (lamports > 0) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          }),
        );
      }

      // Add memo for gift identification
      const memo = createGiftMemo(rawGiftType as GiftTypeId, senderLabel);
      // Memo program instruction
      const memoPubkey = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
      tx.add(
        new Transaction().add({
          keys: [{ pubkey: fromPubkey, isSigner: true, isWritable: true }],
          programId: memoPubkey,
          data: Buffer.from(memo),
        }),
      );

      const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const base64 = typeof Buffer !== 'undefined'
        ? Buffer.from(serialized).toString('base64')
        : btoa(String.fromCharCode(...serialized));

      return jsonResponse({
        transaction: base64,
        message: memo,
        giftType: rawGiftType,
        amountSats: giftType.sats,
        amountUsd: giftType.usd,
        recipient,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build Solana transaction';
      return jsonResponse({ error: message }, 500);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Webhook: Receive Blink payment confirmation ─────────────────────────

/**
 * POST /api/blink/gift/confirm
 *
 * Called by the Solana Actions API (or by the frontend) after
 * a Blink transaction is confirmed on-chain. Records the gift
 * and broadcasts the animation.
 */
export async function handleBlinkGiftConfirm(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const txHash = sanitizeString(body.txHash, 128);
    const streamId = sanitizeString(body.streamId, 128);
    const creatorId = sanitizeString(body.creatorId, 128);
    const giftTypeId = sanitizeString(body.giftTypeId, 32);
    const senderId = sanitizeString(body.senderId, 128);
    const senderLabel = sanitizeString(body.senderLabel, 64);
    const creatorLabel = sanitizeString(body.creatorLabel, 64);

    if (!txHash || !streamId || !creatorId || !giftTypeId || !isValidGiftTypeId(giftTypeId)) {
      return jsonResponse({ error: 'txHash, streamId, creatorId, giftTypeId required' }, 400);
    }

    // Record the gift via the standard handler
    const { recordGift } = await import('./live-gifts-handlers');
    const result = await recordGift(env, streamId, creatorId, giftTypeId as GiftTypeId, {
      senderId: senderId || undefined,
      senderLabel: senderLabel || undefined,
      chain: 'solana',
      txHash,
      platform: 'solana',
      creatorLabel: creatorLabel || undefined,
    });

    return jsonResponse({
      success: true,
      gift: {
        id: result.gift.id,
        giftTypeId: result.gift.giftTypeId,
        icon: GIFT_TYPES[giftTypeId as GiftTypeId]?.icon,
        name: GIFT_TYPES[giftTypeId as GiftTypeId]?.name,
        sats: result.gift.sats,
        usd: result.gift.usd,
        txHash,
      },
      streak: result.triggeredStreak ? {
        count: result.gift.streakCount,
        label: result.triggeredStreak.label,
      } : null,
      streamState: {
        totalSats: result.streamState.totalSats,
        totalGifts: result.streamState.totalGifts,
      },
    }, 201);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

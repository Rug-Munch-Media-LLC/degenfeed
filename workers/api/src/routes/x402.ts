import { Transaction } from '@solana/web3.js';
import { jsonResponse, paymentRequired } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isValidAmount,
  isValidSolanaAddress,
  sanitizeString,
} from '../sanitize';
import type { Env } from '../types';

const DEFAULT_PAYWALL_AMOUNT = '0.001';

interface VerifyBody {
  proof?: unknown;
}

export async function handleX402Paywall(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const creator = sanitizeString(url.searchParams.get('creator'), 128);
  const amount = sanitizeString(url.searchParams.get('amount') || DEFAULT_PAYWALL_AMOUNT, 64);

  if (
    !creator ||
    !isValidSolanaAddress(creator) ||
    !isValidAmount(amount) ||
    hasSuspiciousPayload(`${creator}${amount}`)
  ) {
    return jsonResponse({ error: 'Valid creator Solana address and amount required' }, 400);
  }

  const blinkUrl = `https://app.degenfeed.xyz/api/blink/tip?recipient=${encodeURIComponent(creator)}&amount=${encodeURIComponent(amount)}`;
  return paymentRequired('Payment required', { 'X-Payment-Required': `solana:${blinkUrl}` });
}

export async function handleX402Verify(request: Request, _env: Env): Promise<Response> {
  let body: VerifyBody = {};
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const proof = sanitizeString(body.proof, 4096);
  if (!proof) {
    return jsonResponse({ error: 'proof required' }, 400);
  }

  try {
    const bytes = Uint8Array.from(atob(proof), (c) => c.charCodeAt(0));
    const tx = Transaction.from(bytes);
    const ok = tx.verifySignatures();
    return jsonResponse({ ok });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid proof';
    return jsonResponse({ error: message }, 400);
  }
}

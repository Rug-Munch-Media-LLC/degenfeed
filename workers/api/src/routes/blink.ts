import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { jsonResponse, methodNotAllowed } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isValidAmount,
  isValidSolanaAddress,
  sanitizeString,
} from '../sanitize';
import type { Env } from '../types';

const MAX_TIP_SOL = 1;
const DEFAULT_BLINK_RPC = 'https://api.mainnet-beta.solana.com';

interface BlinkAction {
  title: string;
  icon: string;
  description: string;
  label: string;
  links: {
    actions: Array<{ label: string; href: string }>;
  };
}

export async function handleBlinkTip(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    return jsonResponse(buildBlinkAction(url));
  }
  if (request.method === 'POST') {
    return handleBlinkTipPost(request, env, url);
  }
  return methodNotAllowed(['POST']);
}

function buildBlinkAction(url: URL): BlinkAction {
  const origin = `${url.protocol}//${url.host}`;
  return {
    title: 'Tip on DegenFeed',
    icon: `${origin}/favicon.ico`,
    description: 'Send a tip to a DegenFeed creator',
    label: 'Tip',
    links: {
      actions: [
        {
          label: 'Tip',
          href: `${origin}/api/blink/tip?recipient={recipient}&amount={amount}`,
        },
      ],
    },
  };
}

async function handleBlinkTipPost(request: Request, env: Env, url: URL): Promise<Response> {
  const rawRecipient = sanitizeString(url.searchParams.get('recipient'), 128);
  const rawAmount = sanitizeString(url.searchParams.get('amount'), 64);
  let body: { account?: unknown } = {};
  try {
    body = (await request.json()) as { account?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const account = sanitizeString(body.account, 128);

  if (!rawRecipient || !rawAmount || !account) {
    return jsonResponse({ error: 'recipient, amount, and account required' }, 400);
  }
  if (!isValidAmount(rawAmount) || hasSuspiciousPayload(`${rawRecipient}${rawAmount}${account}`)) {
    return jsonResponse({ error: 'Invalid recipient or amount' }, 400);
  }

  const amount = Number.parseFloat(rawAmount);
  if (Number.isNaN(amount) || amount <= 0 || amount > MAX_TIP_SOL) {
    return jsonResponse({ error: `Amount must be between 0 and ${MAX_TIP_SOL} SOL` }, 400);
  }
  if (!isValidSolanaAddress(account)) {
    return jsonResponse({ error: 'Invalid sender account' }, 400);
  }

  const recipient = await resolveRecipient(rawRecipient);
  if (!recipient) {
    return jsonResponse({ error: 'Recipient must be a valid Solana address' }, 400);
  }

  try {
    const rpcUrl = env.SOLANA_RPC_URL || DEFAULT_BLINK_RPC;
    const connection = new Connection(rpcUrl, 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();

    const fromPubkey = new PublicKey(account);
    const toPubkey = new PublicKey(recipient);

    const tx = new Transaction();
    tx.feePayer = fromPubkey;
    tx.recentBlockhash = blockhash;
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

    return jsonResponse({
      transaction: base64,
      message: `Tip ${rawAmount} SOL to ${recipient}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build transaction';
    return jsonResponse({ error: message }, 500);
  }
}

async function resolveRecipient(input: string): Promise<string | null> {
  if (isValidSolanaAddress(input)) return input;
  return null;
}

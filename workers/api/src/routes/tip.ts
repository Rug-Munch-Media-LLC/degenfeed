import { type Env, jsonResponse } from '../index';
import {
  hasSuspiciousPayload,
  isAllowedProtocol,
  isValidAmount,
  isValidEvmAddress,
  isValidSolanaAddress,
  sanitizeString,
  validateBodySize,
} from '../sanitize';
import { buildLensCollectIntent } from './lens';
import { fetchZapInvoice, resolveLnurlFromPubkey } from './lightning';

export interface ResolvedTipMethod {
  method: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  address?: string;
  chain?: string;
  minAmount?: number;
  fee?: string;
  /** For methods that need a URL (Farcaster Frame, Lens collect) */
  actionUrl?: string;
  /** True for the auto-routed best method */
  recommended?: boolean;
  /** Rank for sorting: lower is better */
  rank?: number;
}

export interface TipPostContext {
  protocol: string;
  authorId: string;
  /** Author monetization preferences when known */
  author?: {
    evmAddress?: string;
    solanaAddress?: string;
    lightningAddress?: string;
    farcasterCustodyAddress?: string;
    lensProfile?: string;
    nostrPubkey?: string;
  };
  /** Protocol-specific metadata */
  meta?: {
    hasCollectModule?: boolean;
    publicationId?: string;
  };
}

const METHOD_RANK = {
  native: 0,
  lightning_zap: 1,
  ethereum: 2,
  base: 2,
  solana: 3,
  farcaster_frame: 4,
  lens_collect: 5,
} as const;

function methodBaseRank(method: string): number {
  switch (method) {
    case 'lightning_zap':
      return METHOD_RANK.lightning_zap;
    case 'ethereum':
      return METHOD_RANK.ethereum;
    case 'base':
      return METHOD_RANK.base;
    case 'solana':
      return METHOD_RANK.solana;
    case 'farcaster_frame':
      return METHOD_RANK.farcaster_frame;
    case 'lens_collect':
      return METHOD_RANK.lens_collect;
    default:
      return 99;
  }
}

function parsePostContext(input: string | null): TipPostContext | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input) as TipPostContext;
    if (
      typeof parsed.protocol === 'string' &&
      typeof parsed.authorId === 'string' &&
      isAllowedProtocol(parsed.protocol) &&
      !hasSuspiciousPayload(parsed.authorId)
    ) {
      return parsed;
    }
  } catch {
    /* ignore invalid JSON */
  }
  return null;
}

function markRecommended(methods: ResolvedTipMethod[], method: string): ResolvedTipMethod[] {
  return methods.map((m) => (m.method === method ? { ...m, recommended: true } : m));
}

/**
 * Rank methods for a given protocol + author context.
 * Order: native protocol method > Lightning > EVM > Solana.
 */
export function rankMethods(
  methods: ResolvedTipMethod[],
  protocol: string,
  postContext?: TipPostContext | null,
): ResolvedTipMethod[] {
  const author = postContext?.author;

  // Determine native method and whether it is viable
  let nativeMethod: string | null = null;
  switch (protocol) {
    case 'nostr':
      if (author?.lightningAddress || author?.nostrPubkey) {
        nativeMethod = 'lightning_zap';
      }
      break;
    case 'lens':
      if (postContext?.meta?.hasCollectModule || author?.lensProfile) {
        nativeMethod = 'lens_collect';
      }
      break;
    case 'farcaster':
      if (author?.farcasterCustodyAddress) {
        nativeMethod = 'base';  // Base chain for Farcaster
      } else if (author?.evmAddress) {
        nativeMethod = 'ethereum';
      }
      break;
    default:
      nativeMethod = null;
  }

  // Apply availability from author context
  const contextualized = methods.map((m) => {
    switch (m.method) {
      case 'ethereum':
        return {
          ...m,
          available: m.available || !!author?.evmAddress,
          address: author?.evmAddress,
        };
      case 'solana':
        return {
          ...m,
          available: m.available || !!author?.solanaAddress,
          address: author?.solanaAddress,
        };
      case 'lightning_zap':
        return {
          ...m,
          available: m.available || !!author?.lightningAddress || !!author?.nostrPubkey,
          address: author?.lightningAddress,
        };
      case 'farcaster_frame':
        return {
          ...m,
          available: m.available || !!author?.farcasterCustodyAddress,
          address: author?.farcasterCustodyAddress,
        };
      case 'lens_collect':
        return {
          ...m,
          available: m.available || !!postContext?.meta?.hasCollectModule || !!author?.lensProfile,
          address: author?.lensProfile,
        };
      default:
        return m;
    }
  });

  // Compute ranks: native protocol gets top priority when available
  const ranked = contextualized.map((m) => {
    let rank = methodBaseRank(m.method);
    if (nativeMethod && m.method === nativeMethod && m.available) {
      rank = METHOD_RANK.native;
    }
    return { ...m, rank };
  });

  ranked.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // Mark the first available method as recommended
  const firstAvailable = ranked.find((m) => m.available);
  if (firstAvailable) {
    return markRecommended(ranked, firstAvailable.method);
  }

  return ranked;
}

function buildBaseMethods(protocol: string, env: Env): ResolvedTipMethod[] {
  const methods: ResolvedTipMethod[] = [];

  methods.push({
    method: 'ethereum',
    label: 'Ethereum / EVM',
    description: 'Send ETH, USDC, or any ERC-20 on Ethereum, Optimism, Arbitrum, Polygon',
    icon: '◆',
    available: false,
    chain: 'ethereum',
    minAmount: 0.0001,
    fee: '~$0.05-5 (varies by chain)',
  });

  methods.push({
    method: 'base',
    label: 'Base',
    description: 'Send ETH or USDC on Base — fast, cheap, Farcaster-native',
    icon: '🔵',
    available: false,
    chain: 'base',
    minAmount: 0.0001,
    fee: '< $0.01',
  });

  methods.push({
    method: 'solana',
    label: 'Solana',
    description: 'Send SOL, USDC, or any SPL token — sub-cent fees',
    icon: '◎',
    available: false,
    chain: 'solana',
    minAmount: 0.001,
    fee: '< $0.01',
  });

  switch (protocol) {
    case 'nostr':
      methods.push({
        method: 'lightning_zap',
        label: 'Lightning Zap',
        description: 'Bitcoin Lightning via Nostr zaps — instant, near-zero fees',
        icon: '⚡',
        available: false,
        minAmount: 1,
        fee: '< $0.001',
      });
      break;

    case 'farcaster':
      methods.push({
        method: 'farcaster_frame',
        label: 'Farcaster Frame',
        description: 'Tip via Farcaster Frame — embeddable in any cast',
        icon: '◈',
        available: false,
        actionUrl: `${env.GTS_INSTANCE_URL || 'https://degenfeed.xyz'}/api/tip/frame/${encodeURIComponent('author')}`,
        fee: '~$0.01-0.50',
      });
      break;

    case 'lens':
      methods.push({
        method: 'lens_collect',
        label: 'Lens Collect',
        description: 'Collect this post via Lens protocol — supports free + paid collects',
        icon: '◎',
        available: false,
        fee: '~$0.01-1',
      });
      break;

    case 'bluesky':
    case 'threads':
    case 'mastodon':
      break;

    default:
      break;
  }

  return methods;
}

export async function handleTipResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocol = sanitizeString(url.searchParams.get('protocol'), 32);
  const authorId = sanitizeString(url.searchParams.get('authorId'), 256);
  const postContextParam = sanitizeString(url.searchParams.get('postContext'), 2048);

  if (!protocol || !authorId || !isAllowedProtocol(protocol) || hasSuspiciousPayload(authorId)) {
    return jsonResponse({ error: 'protocol and authorId required' }, 400);
  }

  const postContext = parsePostContext(postContextParam);

  const baseMethods = buildBaseMethods(protocol, env);
  const rankedMethods = rankMethods(baseMethods, protocol, postContext);

  return jsonResponse({ methods: rankedMethods, resolved: true });
}

export async function handleTipCreate(request: Request, _env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);
  try {
    const body = (await request.json()) as {
      recipient: string;
      recipientProtocol: string;
      method: string;
      amount: string;
      chain?: string;
      sender?: string;
      publicationId?: string;
    };

    const recipient = sanitizeString(body.recipient, 128);
    const recipientProtocol = sanitizeString(body.recipientProtocol, 32);
    const method = sanitizeString(body.method, 32);
    const amount = sanitizeString(body.amount, 64);
    const chain = sanitizeString(body.chain, 32);
    const sender = sanitizeString(body.sender, 128);
    const publicationId = sanitizeString(body.publicationId, 128);

    if (
      !recipient ||
      !method ||
      !amount ||
      !isValidAmount(amount) ||
      hasSuspiciousPayload(
        `${recipient}${recipientProtocol}${method}${amount}${sender}${publicationId}`,
      )
    ) {
      return jsonResponse({ error: 'recipient, method, and amount required' }, 400);
    }

    if (recipientProtocol && !isAllowedProtocol(recipientProtocol)) {
      return jsonResponse({ error: 'Invalid recipientProtocol' }, 400);
    }
    if (chain && chain !== 'ethereum' && chain !== 'solana' && chain !== 'base') {
      return jsonResponse({ error: 'Invalid chain' }, 400);
    }

    switch (method) {
      case 'ethereum':
      case 'base':
        return jsonResponse({
          method,
          intent: {
            to: recipient,
            value: amount,
            chain: method === 'base' ? 'base' : (chain || 'ethereum'),
          },
          instructions:
            'Sign with your Ethereum wallet (MetaMask, Rabby, Rainbow, etc.) to send the tip',
        });

      case 'solana':
        return jsonResponse({
          method: 'solana',
          intent: {
            to: recipient,
            amount: amount,
            chain: 'solana',
          },
          instructions:
            'Sign with your Solana wallet (Phantom, Solflare, Backpack, etc.) to send the tip',
        });

      case 'lightning_zap':
        return jsonResponse({
          method: 'lightning_zap',
          intent: {
            to: recipient,
            amount: amount,
            note: 'Tip from DegenFeed',
            zapEndpoint: '/api/tip/lightning/invoice',
          },
          instructions:
            'Pay the Lightning invoice with your Nostr-compatible wallet (Alby, Wallet of Satoshi, etc.)',
        });

      case 'farcaster_frame':
        return jsonResponse({
          method: 'farcaster_frame',
          intent: {
            recipient: recipient,
            amount: amount,
            actionUrl: `/api/tip/frame/${encodeURIComponent(recipient)}?amount=${amount}`,
          },
          instructions: 'Complete the tip via the Farcaster Frame',
        });

      case 'lens_collect': {
        if (!publicationId) {
          return jsonResponse({ error: 'publicationId required for Lens collect' }, 400);
        }
        const lensIntent = buildLensCollectIntent(publicationId, sender);
        if (!lensIntent) {
          return jsonResponse({ error: 'Invalid Lens publicationId format' }, 400);
        }
        return jsonResponse({
          method: 'lens_collect',
          intent: lensIntent,
          instructions: 'Sign the Polygon transaction to collect this Lens post',
        });
      }

      default:
        return jsonResponse({ error: `Unknown tipping method: ${method}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

export interface CreatorTipSettings {
  evmAddress?: string;
  solanaAddress?: string;
  lightningAddress?: string;
  farcasterCustodyAddress?: string;
  lensProfile?: string;
  nostrPubkey?: string;
  preferredMethod?: string;
}

function sanitizeSettings(input: unknown): CreatorTipSettings | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  const settings: CreatorTipSettings = {};

  const evmAddress = sanitizeString(raw.evmAddress, 128);
  if (evmAddress && !isValidEvmAddress(evmAddress)) return null;
  if (evmAddress) settings.evmAddress = evmAddress;

  const solanaAddress = sanitizeString(raw.solanaAddress, 128);
  if (solanaAddress && !isValidSolanaAddress(solanaAddress)) return null;
  if (solanaAddress) settings.solanaAddress = solanaAddress;

  const lightningAddress = sanitizeString(raw.lightningAddress, 128);
  if (lightningAddress) settings.lightningAddress = lightningAddress;

  const farcasterCustodyAddress = sanitizeString(raw.farcasterCustodyAddress, 128);
  if (farcasterCustodyAddress && !isValidEvmAddress(farcasterCustodyAddress)) return null;
  if (farcasterCustodyAddress) settings.farcasterCustodyAddress = farcasterCustodyAddress;

  const lensProfile = sanitizeString(raw.lensProfile, 128);
  if (lensProfile) settings.lensProfile = lensProfile;

  const nostrPubkey = sanitizeString(raw.nostrPubkey, 128);
  if (nostrPubkey) settings.nostrPubkey = nostrPubkey;

  const preferredMethod = sanitizeString(raw.preferredMethod, 32);
  if (preferredMethod) settings.preferredMethod = preferredMethod;

  return settings;
}

/**
 * GET /api/tip/settings?wallet=0x...
 * Returns the creator's configured addresses from KV.
 */
export async function handleTipSettingsGet(request: Request, env: Env): Promise<Response> {
  const wallet = new URL(request.url).searchParams.get('wallet')?.toLowerCase();
  if (!wallet) {
    return jsonResponse({ settings: {}, localFirst: false });
  }
  try {
    const key = `tip:settings:${wallet}`;
    const stored = await env.CACHE?.get(key);
    if (stored) {
      return jsonResponse({ settings: JSON.parse(stored), localFirst: false });
    }
  } catch {
    /* KV unavailable */
  }
  return jsonResponse({ settings: {}, localFirst: false });
}

/**
 * POST /api/tip/settings
 * Stores creator monetization settings in KV, keyed by wallet address.
 * Body: { wallet: '0x...', settings: {...} }
 */
export async function handleTipSettingsPost(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);
  try {
    const body = (await request.json()) as { wallet?: string; settings?: Record<string, unknown> };
    const wallet = (body.wallet ?? '').toLowerCase();
    if (!wallet || !/^(0x[a-f0-9]{40}|[1-9a-hj-z]{32,44})$/.test(wallet)) {
      return jsonResponse({ error: 'Valid wallet address required' }, 400);
    }
    const settings = sanitizeSettings(body.settings ?? {});
    if (!settings) {
      return jsonResponse({ error: 'Invalid settings' }, 400);
    }
    const key = `tip:settings:${wallet}`;
    try {
      await env.CACHE?.put(key, JSON.stringify(settings), { expirationTtl: 60 * 60 * 24 * 90 });
    } catch {
      /* KV unavailable */
    }
    return jsonResponse({ success: true, settings, localFirst: false });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

/**
 * Generate a Lightning zap invoice for a Nostr user.
 */
export async function handleLightningInvoice(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pubkey = url.searchParams.get('pubkey') || '';
  const amountSats = Number.parseFloat(url.searchParams.get('amount') || '1000');
  const comment = url.searchParams.get('comment') || 'Tip from DegenFeed';

  if (!pubkey) {
    return jsonResponse({ error: 'pubkey required' }, 400);
  }

  const relays = (env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol').split(',');
  const lnurl = await resolveLnurlFromPubkey(pubkey, relays);

  if (!lnurl) {
    return jsonResponse({ error: 'No LNURL found for this Nostr pubkey' }, 404);
  }

  // Convert sats to msat (1 sat = 1,000 msat)
  const amountMsat = Math.floor(amountSats * 1000);
  const result = await fetchZapInvoice(lnurl, amountMsat, comment);

  if (result.status === 'ERROR') {
    return jsonResponse({ error: result.reason || 'Failed to get invoice' }, 500);
  }

  return jsonResponse({
    invoice: result.pr,
    amount: result.amount,
    expiresAt: result.expires_at,
    allowsNsec: result.allowsNsec,
    commentAllowed: result.commentAllowed,
  });
}

/**
 * Farcaster Frame endpoint for tipping.
 * Returns Open Graph meta tags that Farcaster clients render as a tipping Frame.
 * recipientId should be the creator's Ethereum address.
 */
export async function handleTipFrame(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const recipientId = sanitizeString(parts[parts.length - 1], 128);
  const amount = sanitizeString(url.searchParams.get('amount') || '0.001', 64);

  if (
    !recipientId ||
    !amount ||
    !isValidAmount(amount) ||
    hasSuspiciousPayload(`${recipientId}${amount}`)
  ) {
    return jsonResponse({ error: 'Invalid frame params' }, 400);
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="https://degenfeed.xyz/og/tip.png" />
  <meta property="fc:frame:button:1" content="⚡ Tip ${amount} ETH" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="https://degenfeed.xyz/api/tip/frame/tx/${encodeURIComponent(recipientId)}?amount=${amount}" />
  <meta property="fc:frame:post_url" content="https://degenfeed.xyz/api/tip/frame/callback/${encodeURIComponent(recipientId)}?amount=${amount}" />
  <meta property="og:title" content="Tip on DegenFeed" />
  <meta property="og:description" content="Send a tip via DegenFeed — cross-platform, no platform fees" />
</head>
<body>
  <p>DegenFeed Tipping Frame — open this in a Farcaster client to send a tip.</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/**
 * Farcaster Frame transaction endpoint.
 * Receives a POST from the Farcaster client and returns eth_sendTransaction params.
 */
export async function handleTipFrameTx(request: Request, _env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const recipientId = sanitizeString(parts[parts.length - 1], 128);
    const amount = sanitizeString(url.searchParams.get('amount') || '0.001', 64);

    if (
      !recipientId ||
      !amount ||
      !isValidAmount(amount) ||
      hasSuspiciousPayload(`${recipientId}${amount}`)
    ) {
      return jsonResponse({ error: 'Invalid frame params' }, 400);
    }

    const bodySizeCheck = validateBodySize(request, 10 * 1024);
    if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);
    const body = (await request.json()) as Record<string, unknown>;
    const fid =
      ((body.untrustedData as Record<string, unknown>)?.fid as number) || (body.fid as number);
    if (!fid) {
      return jsonResponse({ error: 'Invalid Frame action: missing fid' }, 400);
    }

    const to = recipientId.startsWith('0x') ? recipientId : null;
    if (!to) {
      return jsonResponse({ error: 'Invalid recipient address' }, 400);
    }

    const valueHex = `0x${BigInt(Math.floor(Number.parseFloat(amount) * 1e18)).toString(16)}`;

    return jsonResponse({
      chainId: 'eip155:1',
      method: 'eth_sendTransaction',
      params: {
        to,
        value: valueHex,
      },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

/**
 * Farcaster Frame callback endpoint.
 * Receives the transaction hash after the user signs in their wallet.
 */
export async function handleTipFrameCallback(request: Request, _env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const _recipientId = parts[parts.length - 1] || '';
    const _amount = url.searchParams.get('amount') || '0.001';

    const bodySizeCheck = validateBodySize(request, 10 * 1024);
    if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);
    const body = (await request.json()) as Record<string, unknown>;
    const txHash = (((body.untrustedData as Record<string, unknown>)?.transactionId as string) ||
      (body.txHash as string)) as string | undefined;
    const success = !!txHash;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="https://degenfeed.xyz/og/tip.png" />
  <meta property="fc:frame:button:1" content="${success ? '✓ Tip sent!' : 'Tip failed'}" />
  <meta property="og:title" content="Tip on DegenFeed" />
</head>
<body>
  <p>${success ? `Tip sent! Tx: ${txHash}` : 'Tip could not be completed.'}</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch (_err) {
    return new Response('Error', { status: 500 });
  }
}

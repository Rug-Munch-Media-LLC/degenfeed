/**
 * @degenfeed/api-worker — Cross-Protocol Tipping Gateway
 *
 * Unified `/api/tipping/*` API that lets any user tip a creator on ANY
 * protocol in ANY currency, routing to the appropriate payment processor:
 *
 *   Solana          → SOL / USDC (Solana Pay transfer intent + Blink URL)
 *   Ethereum / Base → ETH / USDC (evm transfer intent)
 *   Nostr zaps      → BTC (Lightning via LNURL / NIP-57)
 *   Blinks          → Solana Actions URL (dial.to)
 *   x402            → HTTP 402 payment protocol
 *   Farcaster       → Frame URL
 *   Lens            → Collect transaction intent
 *   Mastodon etc.   → Generic wallet-address tip intent
 *
 * Endpoints:
 *   GET  /api/tipping/options            — currencies/methods per protocol
 *   GET  /api/tipping/detect             — does this author accept tips?
 *   POST /api/tipping/send               — create a cross-protocol tip
 *   GET  /api/tipping/history            — tips this user has sent
 *   GET  /api/tipping/received           — tips a creator has received
 */

import { identityKey } from '@degenfeed/utils';
import { jsonResponse } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isAllowedProtocol,
  isValidAmount,
  isValidEvmAddress,
  isValidSolanaAddress,
  sanitizeString,
  validateBodySize,
} from '../sanitize';
import type { Env } from '../types';
import { buildShareableBlinkUrl } from './blinks-v2';
import { buildLensCollectIntent } from './lens';
import { fetchZapInvoice } from './lightning';
import {
  type ActivityItem,
  kvGetJson,
  recordUnifiedTip,
  type TipEntityType,
  type TipPlatform,
  userReceivedKey,
  userSentKey,
} from './unified-tip-core';
import { x402PaywallResponse } from './x402-enhanced';

// ─── Currency option metadata ────────────────────────────────────────────

export interface TippingCurrencyOption {
  currency: string;
  label: string;
  symbol: string;
  method: string;
  chain?: string;
  /** Fee description shown in the tip UI */
  fee?: string;
}

export interface TippingOptionsResponse {
  protocol: string;
  currencies: TippingCurrencyOption[];
  defaultCurrency: string;
}

interface ProtocolTippingConfig {
  label: string;
  currencies: TippingCurrencyOption[];
  defaultCurrency: string;
}

/** Fee notes per method (display only). */
const METHOD_FEES: Record<string, string> = {
  solana: '< $0.01',
  ethereum: '~$0.05-5 (varies by chain)',
  base: '< $0.01',
  lightning_zap: '< $0.001',
  blink: '< $0.01',
  x402: '< $0.01',
  farcaster_frame: '~$0.01-0.50',
  lens_collect: '~$0.01-1',
  onchain_tip: '0% (L2 gas only)',
};

const currencyOption = (
  currency: string,
  label: string,
  symbol: string,
  method: string,
  chain?: string,
): TippingCurrencyOption => ({ currency, label, symbol, method, chain, fee: METHOD_FEES[method] });

/**
 * Default currency + method options for each protocol. `recipientAddress`
 * may make more methods available (e.g. an EVM address enables onchain_tip).
 */
const PROTOCOL_TIPPING_CONFIG: Record<string, ProtocolTippingConfig> = {
  mastodon: {
    label: 'Mastodon',
    defaultCurrency: 'eth',
    currencies: [
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
      currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('btc', 'Bitcoin (Lightning)', 'BTC', 'lightning_zap'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
    ],
  },
  bluesky: {
    label: 'Bluesky',
    defaultCurrency: 'eth',
    currencies: [
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
      currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('btc', 'Bitcoin (Lightning)', 'BTC', 'lightning_zap'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
    ],
  },
  nostr: {
    label: 'Nostr',
    defaultCurrency: 'btc',
    currencies: [
      currencyOption('btc', 'Bitcoin (Lightning zap)', 'BTC', 'lightning_zap'),
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
      currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
    ],
  },
  farcaster: {
    label: 'Farcaster',
    defaultCurrency: 'base',
    currencies: [
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('btc', 'Bitcoin (Lightning)', 'BTC', 'lightning_zap'),
      currencyOption('farcaster_frame', 'Farcaster Frame', '◈', 'farcaster_frame'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
    ],
  },
  lens: {
    label: 'Lens',
    defaultCurrency: 'matic',
    currencies: [
      currencyOption('lens_collect', 'Lens Collect', '◎', 'lens_collect', 'polygon'),
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
      currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('btc', 'Bitcoin (Lightning)', 'BTC', 'lightning_zap'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
    ],
  },
  solana: {
    label: 'Solana',
    defaultCurrency: 'sol',
    currencies: [
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('usdc', 'USD Coin (Solana)', 'USDC', 'solana', 'solana'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
    ],
  },
  ethereum: {
    label: 'Ethereum',
    defaultCurrency: 'eth',
    currencies: [
      currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
      currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
      currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
      currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
      currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
      currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
    ],
  },
};

const GENERIC_CURRENCIES: TippingCurrencyOption[] = [
  currencyOption('eth', 'Ethereum', 'ETH', 'ethereum', 'ethereum'),
  currencyOption('base', 'Base (ETH)', 'ETH', 'base', 'base'),
  currencyOption('usdc', 'USD Coin', 'USDC', 'base', 'base'),
  currencyOption('sol', 'Solana', 'SOL', 'solana', 'solana'),
  currencyOption('btc', 'Bitcoin (Lightning)', 'BTC', 'lightning_zap'),
  currencyOption('blink', 'Solana Blink', '⚡', 'blink', 'solana'),
  currencyOption('x402', 'HTTP 402 (x402)', '402', 'x402', 'solana'),
];

// ─── Address detection (Part 3) ──────────────────────────────────────────

const ETH_ADDR_RE = /\b0x[a-fA-F0-9]{40}\b/;
const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const LIGHTNING_ADDR_RE = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const LNURL_RE = /(?:lnurl|lightning)[0-9a-z]+/i;
const CASHAPP_RE = /\$[a-zA-Z0-9_]{2,}/;

export interface DetectedAddresses {
  evmAddress?: string;
  solanaAddress?: string;
  lightningAddress?: string;
  cashapp?: string;
}

/** Parse a raw profile blob (bio / description / metadata) for tip addresses. */
export function detectAddressesInText(text: string): DetectedAddresses {
  const detected: DetectedAddresses = {};
  const evmMatch = text.match(ETH_ADDR_RE);
  if (evmMatch) detected.evmAddress = evmMatch[0].toLowerCase();
  const solMatch = text.match(SOL_ADDR_RE);
  if (solMatch) detected.solanaAddress = solMatch[0];
  const lnMatch = text.match(LIGHTNING_ADDR_RE);
  if (lnMatch) detected.lightningAddress = lnMatch[0];
  if (!detected.lightningAddress) {
    const lnurlMatch = text.match(LNURL_RE);
    if (lnurlMatch) detected.lightningAddress = lnurlMatch[0];
  }
  const cashMatch = text.match(CASHAPP_RE);
  if (cashMatch) detected.cashapp = cashMatch[0];
  return detected;
}

/** Parse a JSON-encoded profile (e.g. Nostr kind 0 metadata or unified profile). */
export function detectAddressesInProfile(profileJson: string): DetectedAddresses {
  const detected: DetectedAddresses = {};
  try {
    const parsed = JSON.parse(profileJson) as Record<string, unknown>;
    const get = (key: string): string | undefined => {
      const v = parsed[key];
      return typeof v === 'string' ? v : undefined;
    };
    const evm = get('evmAddress') ?? get('ethAddress') ?? get('walletAddress');
    if (evm && isValidEvmAddress(evm)) detected.evmAddress = evm.toLowerCase();
    const sol = get('solanaAddress');
    if (sol && isValidSolanaAddress(sol)) detected.solanaAddress = sol;
    const ln = get('lud16') ?? get('lud06') ?? get('lightningAddress') ?? get('lightning');
    if (ln) detected.lightningAddress = ln;
    const bio = get('bio') ?? get('description') ?? get('about');
    if (bio) Object.assign(detected, detectAddressesInText(bio));
  } catch {
    // Not JSON — fall through to plain-text detection
    Object.assign(detected, detectAddressesInText(profileJson));
  }
  return detected;
}

/** True if an address string is a Lightning address or LNURL. */
export function isLightningRecipient(address: string): boolean {
  return LIGHTNING_ADDR_RE.test(address) || /^lnurl[0-9a-z]+$/i.test(address);
}

/**
 * Detect whether an author accepts tips for a given protocol, and which
 * currencies are available given their profile.
 */
export function detectAuthorTips(
  protocol: string,
  profileText: string,
  recipientAddress?: string,
): {
  acceptsTips: boolean;
  preferredCurrency: string;
  methods: TippingCurrencyOption[];
  detected: DetectedAddresses;
} {
  const config = PROTOCOL_TIPPING_CONFIG[protocol];
  const detected = profileText
    ? detectAddressesInProfile(profileText)
    : detectAddressesInText(profileText || '');

  if (recipientAddress) {
    if (isValidEvmAddress(recipientAddress)) detected.evmAddress = recipientAddress.toLowerCase();
    else if (isValidSolanaAddress(recipientAddress)) detected.solanaAddress = recipientAddress;
    else if (isLightningRecipient(recipientAddress)) detected.lightningAddress = recipientAddress;
  }

  const baseMethods = config?.currencies ?? GENERIC_CURRENCIES;
  const methods = baseMethods.filter((m) => {
    switch (m.method) {
      case 'ethereum':
      case 'base':
      case 'onchain_tip':
        return !!detected.evmAddress;
      case 'solana':
      case 'blink':
      case 'x402':
        return !!detected.solanaAddress;
      case 'lightning_zap':
        return !!detected.lightningAddress;
      case 'lens_collect':
        return protocol === 'lens' || !!detected.evmAddress;
      case 'farcaster_frame':
        return protocol === 'farcaster';
      default:
        return true;
    }
  });

  const acceptsTips = methods.length > 0 || protocol === 'lens' || protocol === 'farcaster';
  const preferredCurrency = config?.defaultCurrency ?? methods[0]?.currency ?? 'eth';

  return { acceptsTips, preferredCurrency, methods, detected };
}

// ─── GET /api/tipping/options ────────────────────────────────────────────

export async function handleTippingOptions(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const protocol = sanitizeString(url.searchParams.get('protocol'), 32);
  if (protocol) {
    if (!isAllowedProtocol(protocol)) {
      return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
    }
    const config = PROTOCOL_TIPPING_CONFIG[protocol];
    const response: TippingOptionsResponse = config
      ? {
          protocol,
          currencies: config.currencies,
          defaultCurrency: config.defaultCurrency,
        }
      : {
          protocol,
          currencies: GENERIC_CURRENCIES,
          defaultCurrency: 'eth',
        };
    return jsonResponse(response);
  }
  // All protocols
  const all = Object.entries(PROTOCOL_TIPPING_CONFIG).map(([key, cfg]) => ({
    protocol: key,
    label: cfg.label,
    currencies: cfg.currencies,
    defaultCurrency: cfg.defaultCurrency,
  }));
  return jsonResponse({ protocols: all });
}

// ─── GET /api/tipping/detect ─────────────────────────────────────────────

export async function handleTippingDetect(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocol = sanitizeString(url.searchParams.get('protocol'), 32);
  const postId = sanitizeString(url.searchParams.get('postId'), 256);
  const profileText = sanitizeString(url.searchParams.get('profile'), 4096);
  const recipientAddress = sanitizeString(url.searchParams.get('recipientAddress'), 128);
  const authorId = sanitizeString(url.searchParams.get('authorId'), 256);

  if (!protocol || !isAllowedProtocol(protocol)) {
    return jsonResponse({ error: 'Valid protocol query parameter required' }, 400);
  }
  if (hasSuspiciousPayload(`${protocol}${postId}${recipientAddress}${authorId}`)) {
    return jsonResponse({ error: 'Invalid parameters' }, 400);
  }

  // Optional identity lookup: authorId → wallet addresses from IDENTITIES KV
  let resolvedAddress = recipientAddress;
  if (!resolvedAddress && authorId && env.IDENTITIES) {
    try {
      const raw = await env.IDENTITIES.get(identityKey(authorId));
      if (raw) {
        const identity = JSON.parse(raw) as Record<string, unknown>;
        const wallet = identity.walletAddress;
        if (typeof wallet === 'string') resolvedAddress = wallet;
      }
    } catch {
      // Best-effort identity lookup
    }
  }

  const result = detectAuthorTips(protocol, profileText || '', resolvedAddress);
  return jsonResponse({
    postId: postId || null,
    protocol,
    acceptsTips: result.acceptsTips,
    preferredCurrency: result.preferredCurrency,
    methods: result.methods,
    detected: result.detected,
  });
}

// ─── POST /api/tipping/send ──────────────────────────────────────────────

export interface TippingSendRequest {
  postId: string;
  protocol: string;
  amount: number;
  currency: string;
  recipientAddress: string;
  message?: string;
  /** Optional USD value of the tip for the unified ledger (native amounts otherwise). */
  amountUsd?: number;
  /** Optional sender identity (wallet / handle) for ledger + notifications. */
  sender?: string;
}

function toTipPlatform(protocol: string): TipPlatform {
  switch (protocol) {
    case 'bluesky':
    case 'mastodon':
    case 'farcaster':
    case 'lens':
    case 'solana':
      return protocol;
    default:
      return 'degenfeed';
  }
}

function methodFor(protocol: string, currency: string): string {
  switch (currency) {
    case 'sol':
      return 'solana';
    case 'eth':
      return protocol === 'base' ? 'base' : 'ethereum';
    case 'base':
      return 'base';
    case 'usdc':
      return protocol === 'solana' ? 'solana' : 'base';
    case 'btc':
      return 'lightning_zap';
    case 'blink':
      return 'blink';
    case 'x402':
      return 'x402';
    case 'matic':
      return 'lens_collect';
    default:
      return 'onchain_tip';
  }
}

/** Approximate native→USD rates for ledger estimation. Ledger is advisory. */
const APPROX_USD_RATES: Record<string, number> = {
  sol: 150,
  eth: 3500,
  base: 3500,
  btc: 65000,
  matic: 0.6,
  usdc: 1,
};

function estimateUsd(amount: number, currency: string, amountUsd?: number): number {
  if (amountUsd && Number.isFinite(amountUsd) && amountUsd > 0) return amountUsd;
  const rate = APPROX_USD_RATES[currency];
  if (rate) return Math.round(amount * rate * 100) / 100;
  return Math.round(amount * 100) / 100;
}

export async function handleTippingSend(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 16 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as Partial<TippingSendRequest>;
    const postId = sanitizeString(body.postId, 256);
    const protocol = sanitizeString(body.protocol, 32);
    const currency = sanitizeString(body.currency, 16).toLowerCase();
    const recipientAddress = sanitizeString(body.recipientAddress, 128);
    const message = sanitizeString(body.message, 512);
    const sender = sanitizeString(body.sender, 128);
    const amountRaw = sanitizeString(String(body.amount ?? ''), 64);
    const amountNum = Number.parseFloat(amountRaw);

    if (!postId || !protocol || !recipientAddress || !currency || !amountRaw) {
      return jsonResponse(
        { error: 'postId, protocol, amount, currency, and recipientAddress are required' },
        400,
      );
    }
    if (!isAllowedProtocol(protocol)) {
      return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
    }
    if (!isValidAmount(amountRaw) || !Number.isFinite(amountNum) || amountNum <= 0) {
      return jsonResponse({ error: 'Amount must be a positive number' }, 400);
    }
    if (amountNum > 10000) {
      return jsonResponse({ error: 'Amount exceeds maximum (10000)' }, 400);
    }
    if (
      hasSuspiciousPayload(`${postId}${protocol}${currency}${recipientAddress}${message}${sender}`)
    ) {
      return jsonResponse({ error: 'Invalid parameters' }, 400);
    }

    const method = methodFor(protocol, currency);

    // Validate recipient address matches the method's chain when we can.
    if (
      ['ethereum', 'base', 'onchain_tip'].includes(method) &&
      !isValidEvmAddress(recipientAddress)
    ) {
      return jsonResponse(
        { error: `recipientAddress must be a valid EVM address for ${method} tips` },
        400,
      );
    }
    if (method === 'solana' && !isValidSolanaAddress(recipientAddress)) {
      return jsonResponse(
        { error: 'recipientAddress must be a valid Solana address for SOL/USDC tips' },
        400,
      );
    }
    if (method === 'lightning_zap' && !isLightningRecipient(recipientAddress)) {
      return jsonResponse(
        { error: 'recipientAddress must be a Lightning address or LNURL for BTC tips' },
        400,
      );
    }

    const origin = `${request.url.startsWith('https') ? 'https' : 'http'}://${new URL(request.url).host}`;
    const amountStr = String(amountNum);
    const amountUsd = estimateUsd(amountNum, currency, body.amountUsd);

    let intent: Record<string, unknown>;
    let instructions = 'Sign with your wallet to send the tip';
    let processing: 'intent' | 'invoice' | 'blink' | 'x402' | 'frame' | 'collect' = 'intent';
    let actionUrl: string | undefined;

    switch (method) {
      case 'ethereum':
      case 'base':
        intent = {
          to: recipientAddress,
          value: amountStr,
          chain: method === 'base' ? 'base' : currency === 'usdc' ? 'base' : 'ethereum',
          token: currency === 'usdc' ? 'USDC' : undefined,
        };
        instructions =
          'Sign with your Ethereum wallet (MetaMask, Rabby, Rainbow, etc.) to send the tip';
        break;

      case 'solana': {
        const blinkUrl = buildShareableBlinkUrl(origin, {
          recipient: recipientAddress,
          amount: amountStr,
          creatorName: `Post ${postId.slice(0, 32)}`,
          entityType: 'post',
          entityLabel: postId,
          entityId: postId,
        });
        actionUrl = blinkUrl;
        intent = {
          to: recipientAddress,
          amount: amountStr,
          chain: 'solana',
          token: currency === 'usdc' ? 'USDC' : undefined,
          actionUrl: blinkUrl,
        };
        instructions =
          'Sign with your Solana wallet (Phantom, Solflare, Backpack, etc.) or use the Blink';
        processing = 'blink';
        break;
      }

      case 'lightning_zap': {
        try {
          const invoice = await fetchZapInvoice(
            recipientAddress,
            Math.round(amountNum * 1_000_000_000), // BTC → msat
            message || 'Tip from DegenFeed',
          );
          if (invoice.status === 'OK' && invoice.pr) {
            intent = {
              to: recipientAddress,
              amount: amountStr,
              note: 'Tip from DegenFeed',
              invoice: invoice.pr,
              expiresAt: invoice.expires_at,
              zapEndpoint: '/api/tip/lightning/invoice',
            };
            instructions =
              'Pay the Lightning invoice with your Nostr-compatible wallet (Alby, Wallet of Satoshi, etc.)';
            processing = 'invoice';
            break;
          }
        } catch {
          // Fall through to intent-only response
        }
        intent = {
          to: recipientAddress,
          amount: amountStr,
          note: 'Tip from DegenFeed',
          zapEndpoint: '/api/tip/lightning/invoice',
        };
        instructions =
          'Pay the Lightning invoice with your Nostr-compatible wallet (Alby, Wallet of Satoshi, etc.)';
        break;
      }

      case 'blink': {
        const blinkUrl = buildShareableBlinkUrl(origin, {
          recipient: recipientAddress,
          amount: amountStr,
          creatorName: `Post ${postId.slice(0, 32)}`,
          entityType: 'post',
          entityLabel: postId,
          entityId: postId,
        });
        actionUrl = blinkUrl;
        intent = { actionUrl: blinkUrl, amount: amountStr, chain: 'solana' };
        instructions = 'Open the Solana Blink in any blink-compatible client to send the tip';
        processing = 'blink';
        break;
      }

      case 'x402': {
        const paywall = x402PaywallResponse(
          {
            action: 'tip',
            target: recipientAddress,
            amount: amountStr,
            label: message || `Post ${postId.slice(0, 32)}`,
            entityType: 'post',
            entityId: postId,
          },
          env,
          origin,
        );
        actionUrl = paywall.blinkUrl;
        intent = {
          paymentId: paywall.paymentId,
          amount: paywall.amount,
          actionType: paywall.actionType,
          actionUrl: paywall.blinkUrl,
          status: 402,
        };
        instructions = 'Complete the HTTP 402 payment to send the tip';
        processing = 'x402';
        break;
      }

      case 'farcaster_frame':
        actionUrl = `${origin}/api/tip/frame/${encodeURIComponent(recipientAddress)}?amount=${amountStr}`;
        intent = { recipient: recipientAddress, amount: amountStr, actionUrl };
        instructions = 'Complete the tip via the Farcaster Frame';
        processing = 'frame';
        break;

      case 'lens_collect': {
        const collectIntent = buildLensCollectIntent(postId, sender || undefined);
        if (!collectIntent) {
          return jsonResponse(
            { error: 'Invalid Lens publicationId — expected profileId-pubId format' },
            400,
          );
        }
        intent = { ...collectIntent, amount: amountStr };
        instructions = 'Sign the Polygon transaction to collect this Lens post';
        processing = 'collect';
        break;
      }

      default:
        intent = { to: recipientAddress, value: amountStr, chain: 'base' };
        instructions = 'Sign with your wallet to send the tip';
    }

    // ─── Record in the unified cross-platform ledger ───────────────────
    const entityType: TipEntityType = 'post';
    let recorded: { tipId?: string } = {};
    try {
      const activity = await recordUnifiedTip(env, {
        platform: toTipPlatform(protocol),
        entityId: `${protocol}:${postId}`,
        entityType,
        amountUsd,
        fromUserId: sender || undefined,
        toUserId: recipientAddress,
        fromLabel: sender ? sender.slice(0, 6) : 'Anonymous',
        toLabel: `Post ${postId.slice(0, 32)}`,
        entityLabel: `${protocol} post ${postId.slice(0, 64)}`,
        method: `${method}_${currency}`,
      });
      if (activity) recorded = { tipId: activity.id };
    } catch (err) {
      console.warn('[tipping] ledger record failed:', String(err));
    }

    return jsonResponse({
      success: true,
      tipId: recorded.tipId,
      postId,
      protocol,
      currency,
      method,
      amount: amountNum,
      amountUsd,
      recipientAddress,
      processing,
      intent,
      actionUrl,
      instructions,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── GET /api/tipping/history ────────────────────────────────────────────

export interface TippingHistoryItem extends ActivityItem {
  direction: 'sent';
}

export async function handleTippingHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 128);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

  if (!userId || hasSuspiciousPayload(userId)) {
    return jsonResponse({ error: 'userId query parameter required' }, 400);
  }

  const record = await kvGetJson<{
    totalUsd: number;
    count: number;
    lastTipAt: number;
    byPlatform: Record<string, { totalUsd: number; count: number }>;
    recent: ActivityItem[];
  }>(env, userSentKey(userId));

  return jsonResponse({
    userId,
    sent: {
      totalUsd: record?.totalUsd ?? 0,
      count: record?.count ?? 0,
      lastTipAt: record?.lastTipAt ?? null,
      byPlatform: record?.byPlatform ?? {},
    },
    tips: (record?.recent ?? [])
      .slice(0, limit)
      .map((item): TippingHistoryItem => ({ ...item, direction: 'sent' })),
  });
}

// ─── GET /api/tipping/received ───────────────────────────────────────────

export interface TippingReceivedItem extends ActivityItem {
  direction: 'received';
}

export async function handleTippingReceived(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 128);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

  if (!userId || hasSuspiciousPayload(userId)) {
    return jsonResponse({ error: 'userId query parameter required' }, 400);
  }

  const record = await kvGetJson<{
    totalUsd: number;
    count: number;
    lastTipAt: number;
    byPlatform: Record<string, { totalUsd: number; count: number }>;
    tippers: string[];
    recent: ActivityItem[];
  }>(env, userReceivedKey(userId));

  return jsonResponse({
    userId,
    received: {
      totalUsd: record?.totalUsd ?? 0,
      count: record?.count ?? 0,
      lastTipAt: record?.lastTipAt ?? null,
      byPlatform: record?.byPlatform ?? {},
      tipperCount: record?.tippers?.length ?? 0,
    },
    tips: (record?.recent ?? [])
      .slice(0, limit)
      .map((item): TippingReceivedItem => ({ ...item, direction: 'received' })),
  });
}

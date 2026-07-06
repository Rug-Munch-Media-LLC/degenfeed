import { type Env, jsonResponse } from '../index';
import { resolveLnurlFromPubkey, fetchZapInvoice } from './lightning';

interface ResolvedTipMethod {
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
}

export async function handleTipResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || '';
  const authorId = url.searchParams.get('authorId') || '';

  if (!protocol || !authorId) {
    return jsonResponse({ error: 'protocol and authorId required' }, 400);
  }

  const methods: ResolvedTipMethod[] = [];

  // Common crypto methods — always available
  methods.push({
    method: 'ethereum',
    label: 'Ethereum / EVM',
    description: 'Send ETH, USDC, or any ERC-20 on Ethereum, Base, Optimism, Arbitrum, Polygon',
    icon: '◆',
    available: true,
    chain: 'ethereum',
    minAmount: 0.0001,
    fee: '~$0.05-5 (varies by chain)',
  });

  methods.push({
    method: 'solana',
    label: 'Solana',
    description: 'Send SOL, USDC, or any SPL token — sub-cent fees',
    icon: '◎',
    available: true,
    chain: 'solana',
    minAmount: 0.001,
    fee: '< $0.01',
  });

  // Protocol-specific methods
  switch (protocol) {
    case 'nostr':
      methods.push({
        method: 'lightning_zap',
        label: 'Lightning Zap',
        description: 'Bitcoin Lightning via Nostr zaps — instant, near-zero fees',
        icon: '⚡',
        available: true,
        minAmount: 1, // sats
        fee: '< $0.001',
      });
      break;

    case 'farcaster':
      methods.push({
        method: 'farcaster_frame',
        label: 'Farcaster Frame',
        description: 'Tip via Farcaster Frame — embeddable in any cast',
        icon: '◈',
        available: true,
        actionUrl: `${env.GTS_INSTANCE_URL || 'https://degenfeed.xyz'}/api/tip/frame/${encodeURIComponent(authorId)}`,
        fee: '~$0.01-0.50',
      });
      break;

    case 'lens':
      methods.push({
        method: 'lens_collect',
        label: 'Lens Collect',
        description: 'Collect this post via Lens protocol — supports free + paid collects',
        icon: '◎',
        available: true,
        fee: '~$0.01-1',
      });
      break;

    case 'bluesky':
    case 'threads':
    case 'mastodon':
      // Ethereum + Solana already added above
      break;

    default:
      // Unknown protocol — offer generic crypto
      break;
  }

  return jsonResponse({ methods, resolved: true });
}

export async function handleTipCreate(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      recipient: string;
      recipientProtocol: string;
      method: string;
      amount: string;
      chain?: string;
      sender?: string;
    };

    if (!body.recipient || !body.method || !body.amount) {
      return jsonResponse({ error: 'recipient, method, and amount required' }, 400);
    }

    switch (body.method) {
      case 'ethereum':
        return jsonResponse({
          method: 'ethereum',
          intent: {
            to: body.recipient,
            value: body.amount,
            chain: body.chain || 'ethereum',
          },
          instructions: 'Sign with your Ethereum wallet (MetaMask, Rabby, Rainbow, etc.) to send the tip',
        });

      case 'solana':
        return jsonResponse({
          method: 'solana',
          intent: {
            to: body.recipient,
            amount: body.amount,
            chain: 'solana',
          },
          instructions: 'Sign with your Solana wallet (Phantom, Solflare, Backpack, etc.) to send the tip',
        });

      case 'lightning_zap':
        // Fetch a real invoice from the LNURL-pay endpoint
        return jsonResponse({
          method: 'lightning_zap',
          intent: {
            to: body.recipient,
            amount: body.amount,
            note: 'Tip from DegenFeed',
            zapEndpoint: '/api/tip/lightning/invoice',
          },
          instructions: 'Pay the Lightning invoice with your Nostr-compatible wallet (Alby, Wallet of Satoshi, etc.)',
        });

      case 'farcaster_frame':
        return jsonResponse({
          method: 'farcaster_frame',
          intent: {
            recipient: body.recipient,
            amount: body.amount,
            actionUrl: `/api/tip/frame/${encodeURIComponent(body.recipient)}?amount=${body.amount}`,
          },
          instructions: 'Complete the tip via the Farcaster Frame',
        });

      case 'lens_collect':
        return jsonResponse({
          method: 'lens_collect',
          intent: {
            recipient: body.recipient,
            amount: body.amount,
          },
          instructions: 'Collect this post via Lens Protocol',
        });

      default:
        return jsonResponse({ error: 'Unknown tipping method: ' + body.method }, 400);
    }
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
  const amountSats = parseFloat(url.searchParams.get('amount') || '1000');
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
 */
export async function handleTipFrame(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const recipientId = parts[parts.length - 1] || '';
  const amount = url.searchParams.get('amount') || '0.001';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="https://degenfeed.xyz/og/tip.png" />
  <meta property="fc:frame:button:1" content="⚡ Tip ${amount} ETH" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="https://degenfeed.xyz/api/tip/frame/tx/${recipientId}?amount=${amount}" />
  <meta property="fc:frame:post_url" content="https://degenfeed.xyz/api/tip/frame/callback" />
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

import { type Env, jsonResponse } from '../index';

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
}

/**
 * Resolve tipping methods for a given identity.
 * Takes a protocol + author ID and checks all linked identities/wallets
 * to determine what tipping methods are available.
 */
export async function handleTipResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || '';
  const authorId = url.searchParams.get('authorId') || '';

  if (!protocol || !authorId) {
    return jsonResponse({ error: 'protocol and authorId required' }, 400);
  }

  const methods: ResolvedTipMethod[] = [];

  // For now, return available methods based on protocol
  // In production, this would query the identity resolution system
  switch (protocol) {
    case 'nostr':
      methods.push({
        method: 'lightning_zap',
        label: 'Lightning Zap',
        description: 'Send a Bitcoin Lightning tip via Nostr zaps',
        icon: '⚡',
        available: true,
        minAmount: 0.00001,
        fee: '< $0.01',
      });
      methods.push({
        method: 'ethereum',
        label: 'Ethereum',
        description: 'Send ETH or ERC-20 tokens',
        icon: '◆',
        available: true,
        chain: 'ethereum',
        minAmount: 0.001,
        fee: '~$0.50-5',
      });
      methods.push({
        method: 'solana',
        label: 'Solana',
        description: 'Send SOL or SPL tokens',
        icon: '◎',
        available: true,
        chain: 'solana',
        minAmount: 0.01,
        fee: '< $0.01',
      });
      break;

    case 'farcaster':
      methods.push({
        method: 'ethereum',
        label: 'Ethereum',
        description: 'Send ETH or ERC-20 tokens',
        icon: '◆',
        available: true,
        chain: 'ethereum',
        minAmount: 0.001,
        fee: '~$0.50-5',
      });
      break;

    case 'lens':
      methods.push({
        method: 'lens_collect',
        label: 'Lens Collect',
        description: 'Collect this post via Lens protocol',
        icon: '◎',
        available: true,
        fee: '~$0.10-1',
      });
      methods.push({
        method: 'ethereum',
        label: 'Ethereum',
        description: 'Send ETH or ERC-20 tokens',
        icon: '◆',
        available: true,
        chain: 'ethereum',
        minAmount: 0.001,
        fee: '~$0.50-5',
      });
      break;

    case 'bluesky':
    case 'threads':
      methods.push({
        method: 'ethereum',
        label: 'Ethereum',
        description: 'Send ETH or ERC-20 tokens',
        icon: '◆',
        available: true,
        chain: 'ethereum',
        minAmount: 0.001,
        fee: '~$0.50-5',
      });
      methods.push({
        method: 'solana',
        label: 'Solana',
        description: 'Send SOL or SPL tokens',
        icon: '◎',
        available: true,
        chain: 'solana',
        minAmount: 0.01,
        fee: '< $0.01',
      });
      break;

    case 'mastodon':
      methods.push({
        method: 'ethereum',
        label: 'Ethereum',
        description: 'Send ETH or ERC-20 tokens',
        icon: '◆',
        available: true,
        chain: 'ethereum',
        minAmount: 0.001,
        fee: '~$0.50-5',
      });
      methods.push({
        method: 'solana',
        label: 'Solana',
        description: 'Send SOL or SPL tokens',
        icon: '◎',
        available: true,
        chain: 'solana',
        minAmount: 0.01,
        fee: '< $0.01',
      });
      break;

    default:
      // Unknown protocol — offer generic crypto
      methods.push({
        method: 'ethereum',
        label: 'Ethereum',
        description: 'Send ETH or ERC-20 tokens',
        icon: '◆',
        available: true,
        chain: 'ethereum',
        minAmount: 0.001,
        fee: '~$0.50-5',
      });
      methods.push({
        method: 'solana',
        label: 'Solana',
        description: 'Send SOL or SPL tokens',
        icon: '◎',
        available: true,
        chain: 'solana',
        minAmount: 0.01,
        fee: '< $0.01',
      });
  }

  return jsonResponse({ methods, resolved: true });
}

/**
 * Create a tip intent.
 * Returns transaction data that the client signs with their wallet.
 */
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

    // For Ethereum/Solana direct transfers:
    // Return the transaction data that the sender signs
    if (body.method === 'ethereum') {
      // In a full implementation, this would:
      // 1. Look up the recipient's address from their linked identities
      // 2. Create a transaction object
      // 3. Return it for the sender to sign
      return jsonResponse({
        method: 'ethereum',
        intent: {
          to: body.recipient,
          value: body.amount,
          chain: body.chain || 'ethereum',
          // The client signs this with e.g. ethereum.request({ method: 'eth_sendTransaction', params: [{...}] })
        },
        instructions: 'Sign with your Ethereum wallet to send the tip',
      });
    }

    if (body.method === 'solana') {
      return jsonResponse({
        method: 'solana',
        intent: {
          to: body.recipient,
          amount: body.amount,
          chain: 'solana',
        },
        instructions: 'Sign with your Solana wallet to send the tip',
      });
    }

    if (body.method === 'lightning_zap') {
      // Would generate an LNURL invoice
      return jsonResponse({
        method: 'lightning_zap',
        intent: {
          amount: body.amount,
          note: 'Tip from DegenFeed',
        },
        instructions: 'Pay the Lightning invoice with your Nostr-compatible wallet',
      });
    }

    return jsonResponse({ error: 'Unknown tipping method: ' + body.method }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

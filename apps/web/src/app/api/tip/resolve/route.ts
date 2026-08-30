import { type NextRequest, NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

interface TipMethod {
  method: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  address?: string;
  chain?: string;
  minAmount?: number;
  fee?: string;
  actionUrl?: string;
  recommended?: boolean;
}

const PROTOCOL_METHODS: Record<string, TipMethod[]> = {
  nostr: [
    {
      method: 'lightning_zap',
      label: 'Lightning Zap',
      description: 'Bitcoin Lightning Network — instant, low-fee. Requires a Lightning wallet.',
      icon: '⚡',
      available: true,
      minAmount: 1000,
      fee: '< $0.01',
      recommended: true,
    },
    {
      method: 'onchain_tip',
      label: 'On-chain (0% fee)',
      description:
        'ETH via DegenFeed contract on Base/Optimism/Arbitrum — 0% fee, no intermediary.',
      icon: '⛓️',
      available: true,
      chain: 'base',
      fee: '0% (L2 gas only)',
    },
  ],
  farcaster: [
    {
      method: 'base',
      label: 'Base (ETH)',
      description: 'Send ETH on Base L2 — fast and cheap. Requires an EVM wallet.',
      icon: '🔷',
      available: true,
      chain: 'base',
      minAmount: 0.001,
      fee: '< $0.01',
      recommended: true,
    },
    {
      method: 'ethereum',
      label: 'Ethereum (ETH)',
      description: 'Send ETH directly on Ethereum mainnet.',
      icon: '💎',
      available: true,
      chain: 'ethereum',
      minAmount: 0.001,
      fee: 'Variable (gas)',
    },
    {
      method: 'solana',
      label: 'Solana (SOL)',
      description: 'Send SOL via the Solana network.',
      icon: '◎',
      available: true,
      chain: 'solana',
      minAmount: 0.01,
      fee: '< $0.01',
    },
  ],
  lens: [
    {
      method: 'lens_collect',
      label: 'Lens Collect',
      description: 'Collect a Lens publication with ETH or MATIC.',
      icon: '📸',
      available: true,
      chain: 'polygon',
      minAmount: 0.001,
      fee: '< $0.01',
      recommended: true,
    },
    {
      method: 'ethereum',
      label: 'Ethereum (ETH)',
      description: 'Send ETH directly on Ethereum mainnet.',
      icon: '💎',
      available: true,
      chain: 'ethereum',
      minAmount: 0.001,
      fee: 'Variable (gas)',
    },
  ],
  bluesky: [
    {
      method: 'ethereum',
      label: 'Ethereum (ETH)',
      description: 'Send ETH directly on Ethereum mainnet.',
      icon: '💎',
      available: true,
      chain: 'ethereum',
      minAmount: 0.001,
      fee: 'Variable (gas)',
      recommended: true,
    },
    {
      method: 'solana',
      label: 'Solana (SOL)',
      description: 'Send SOL via the Solana network.',
      icon: '◎',
      available: true,
      chain: 'solana',
      minAmount: 0.01,
      fee: '< $0.01',
    },
  ],
  mastodon: [
    {
      method: 'ethereum',
      label: 'Ethereum (ETH)',
      description: 'Send ETH directly on Ethereum mainnet.',
      icon: '💎',
      available: true,
      chain: 'ethereum',
      minAmount: 0.001,
      fee: 'Variable (gas)',
      recommended: true,
    },
    {
      method: 'solana',
      label: 'Solana (SOL)',
      description: 'Send SOL via the Solana network.',
      icon: '◎',
      available: true,
      chain: 'solana',
      minAmount: 0.01,
      fee: '< $0.01',
    },
  ],
  default: [
    {
      method: 'solana',
      label: 'Solana (SOL)',
      description: 'Send SOL via the Solana network.',
      icon: '◎',
      available: true,
      chain: 'solana',
      minAmount: 0.01,
      fee: '< $0.01',
      recommended: true,
    },
    {
      method: 'ethereum',
      label: 'Ethereum (ETH)',
      description: 'Send ETH directly on Ethereum mainnet.',
      icon: '💎',
      available: true,
      chain: 'ethereum',
      minAmount: 0.001,
      fee: 'Variable (gas)',
    },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol') || 'default';
    const postContextRaw = searchParams.get('postContext');

    let postContext: Record<string, unknown> | null = null;
    if (postContextRaw) {
      try {
        postContext = JSON.parse(postContextRaw) as Record<string, unknown>;
      } catch {
        // ignore malformed postContext
      }
    }

    const baseMethods: TipMethod[] = PROTOCOL_METHODS[protocol] || [
      ...(PROTOCOL_METHODS.default || []),
    ];
    let methods: TipMethod[] = [...baseMethods];

    // If postContext has author info with addresses, mark matching methods
    const evmAddress = (postContext?.author as Record<string, string> | undefined)?.evmAddress;
    const solanaAddress = (postContext?.author as Record<string, string> | undefined)
      ?.solanaAddress;
    const lightningAddress = (postContext?.author as Record<string, string> | undefined)
      ?.lightningAddress;

    methods = methods.map((m) => {
      if (m.method === 'onchain_tip' && evmAddress) {
        return { ...m, available: true, address: evmAddress };
      }
      if (m.method === 'solana' && solanaAddress) {
        return { ...m, available: true, address: solanaAddress };
      }
      if (m.method === 'lightning_zap' && lightningAddress) {
        return { ...m, available: true };
      }
      return m;
    });

    return NextResponse.json({ methods });
  } catch {
    return NextResponse.json(
      { error: 'Failed to resolve tipping methods', methods: [] },
      { status: 500 },
    );
  }
}

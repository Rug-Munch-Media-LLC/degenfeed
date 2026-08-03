import type { TipMenuOption } from './types';

export const PROTOCOL_OPTIONS: Record<
  string,
  {
    nativeMethod: {
      method: string;
      label: string;
      icon: string;
      fee: string;
      feeUsd: number;
    } | null;
    bridgeMethod: {
      method: string;
      label: string;
      icon: string;
      fee: string;
      feeUsd: number;
    } | null;
    supportsOnChain: boolean;
    supportsLightning: boolean;
  }
> = {
  nostr: {
    nativeMethod: {
      method: 'lightning_zap',
      label: '⚡ Zap (NIP-57)',
      icon: '⚡',
      fee: '< $0.001',
      feeUsd: 0.001,
    },
    bridgeMethod: null,
    supportsOnChain: true,
    supportsLightning: true,
  },
  farcaster: {
    nativeMethod: {
      method: 'farcaster_frame',
      label: '◈ Tip Frame',
      icon: '◈',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    bridgeMethod: null,
    supportsOnChain: true,
    supportsLightning: true,
  },
  lens: {
    nativeMethod: {
      method: 'lens_collect',
      label: '◎ Lens Collect',
      icon: '◎',
      fee: '~$0.01',
      feeUsd: 0.01,
    },
    bridgeMethod: null,
    supportsOnChain: true,
    supportsLightning: true,
  },
  zora: {
    nativeMethod: {
      method: 'zora_mint',
      label: '🎨 Bid on Zora',
      icon: '🎨',
      fee: '~$0.01-0.05',
      feeUsd: 0.03,
    },
    bridgeMethod: {
      method: 'degenfeed_tip',
      label: '🔄 Tip via DegenFeed',
      icon: '🔄',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    supportsOnChain: true,
    supportsLightning: true,
  },
  bluesky: {
    nativeMethod: {
      method: 'bluesky_custom',
      label: '☁️ Bluesky Tip',
      icon: '☁️',
      fee: '~$0.001',
      feeUsd: 0.001,
    },
    bridgeMethod: {
      method: 'qr_code',
      label: '📱 QR Code (DegenFeed)',
      icon: '📱',
      fee: 'Free',
      feeUsd: 0,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
  mastodon: {
    nativeMethod: null,
    bridgeMethod: {
      method: 'bridge',
      label: '🌉 DegenFeed Bridge',
      icon: '🌉',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
  lemmy: {
    nativeMethod: null,
    bridgeMethod: {
      method: 'bridge',
      label: '🌉 DegenFeed Bridge',
      icon: '🌉',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
  github: {
    nativeMethod: {
      method: 'github_sponsors',
      label: '🐙 GitHub Sponsors',
      icon: '🐙',
      fee: 'Free',
      feeUsd: 0,
    },
    bridgeMethod: {
      method: 'link',
      label: '🔗 Tip Link (DegenFeed)',
      icon: '🔗',
      fee: 'Free',
      feeUsd: 0,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
};

export const CHAIN_FEES: Record<string, { fee: string; feeUsd: number }> = {
  lightning: { fee: '< $0.001', feeUsd: 0.001 },
  ethereum: { fee: '~$0.50-5.00', feeUsd: 2.0 },
  base: { fee: '< $0.01', feeUsd: 0.01 },
  solana: { fee: '< $0.01', feeUsd: 0.002 },
  polygon: { fee: '~$0.01-0.05', feeUsd: 0.03 },
};

export const OUR_NETWORK_OPTIONS: TipMenuOption[] = [
  {
    method: 'lightning',
    label: '⚡ Lightning (instant, <$0.001)',
    description: 'Bitcoin Lightning — instant, near-zero fees, works globally',
    icon: '⚡',
    available: true,
    fee: '< $0.001',
    feeUsd: 0.001,
    recommended: true,
    isNative: false,
    isBridge: false,
    chain: 'lightning',
  },
  {
    method: 'onchain_tip',
    label: '⛓️ Direct on-chain (0% fee)',
    description: 'ETH via DegenFeed contract on Base — 0% fee, no intermediary',
    icon: '⛓️',
    available: true,
    fee: '0% (L2 gas only)',
    feeUsd: 0.01,
    recommended: false,
    isNative: false,
    isBridge: false,
    chain: 'base',
  },
  {
    method: 'base',
    label: '🔵 Base (USDC/ETH)',
    description: 'Send USDC or ETH on Base L2 — sub-cent fees, fast settlement',
    icon: '🔵',
    available: true,
    fee: '< $0.01',
    feeUsd: 0.01,
    recommended: false,
    isNative: false,
    isBridge: false,
    chain: 'base',
  },
  {
    method: 'solana',
    label: '◎ Solana',
    description: 'Send SOL, USDC, or any SPL token — sub-cent fees, fast',
    icon: '◎',
    available: true,
    fee: '< $0.01',
    feeUsd: 0.002,
    recommended: false,
    isNative: false,
    isBridge: false,
    chain: 'solana',
  },
  {
    method: 'creator_coin',
    label: '🪙 Creator Coin',
    description: 'Buy and tip creator-branded coins — support while investing',
    icon: '🪙',
    available: false,
    fee: 'Low (varies)',
    feeUsd: 0.1,
    recommended: false,
    isNative: false,
    isBridge: false,
  },
  {
    method: 'usdc',
    label: '● USDC (any chain)',
    description: 'Send USDC stablecoin on any supported chain — no volatility',
    icon: '●',
    available: true,
    fee: 'Varies by chain',
    feeUsd: 0.05,
    recommended: false,
    isNative: false,
    isBridge: false,
  },
];

export const AMOUNT_PRESETS_USD = [
  { label: '$1', value: '1', usd: 1 },
  { label: '$5', value: '5', usd: 5 },
  { label: '$10', value: '10', usd: 10 },
  { label: '$25', value: '25', usd: 25 },
];

export const AMOUNT_PRESETS_SATS = [
  { label: '1K', value: '1000', usd: 0.6 },
  { label: '5K', value: '5000', usd: 3.0 },
  { label: '10K', value: '10000', usd: 6.0 },
  { label: '50K', value: '50000', usd: 30.0 },
];

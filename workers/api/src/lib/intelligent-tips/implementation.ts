/**
 * @degenfeed/api-worker — Intelligent Tips Implementation
 *
 * Context-aware tip routing: determines the best way to tip a creator
 * based on what we know about them (wallet, protocol identity, etc.).
 */
import type { ProtocolTipCapability, TipMethod } from './types';

/**
 * Get the protocol's tipping capability.
 * Determines how a tip can be routed based on protocol knowledge.
 */
export function getProtocolCapability(
  protocol: string,
  knownWallet: boolean,
): ProtocolTipCapability {
  // Protocol capability map
  const capabilities: Record<string, { method: TipMethod; chain: string }> = {
    ethereum: { method: 'wallet', chain: 'eth' },
    base: { method: 'wallet', chain: 'base' },
    polygon: { method: 'wallet', chain: 'polygon' },
    solana: { method: 'wallet', chain: 'solana' },
    nostr: { method: 'zap', chain: 'btc' },
    farcaster: { method: 'frame', chain: 'base' },
    lens: { method: 'wallet', chain: 'polygon' },
    bluesky: { method: 'wallet', chain: 'base' },
    mastodon: { method: 'wallet', chain: 'eth' },
    youtube: { method: 'fiat', chain: '' },
    twitch: { method: 'fiat', chain: '' },
    github: { method: 'fiat', chain: '' },
    kick: { method: 'fiat', chain: '' },
    peertube: { method: 'wallet', chain: 'eth' },
  };

  const cap = capabilities[protocol] || { method: 'link' as TipMethod, chain: '' };

  return {
    protocol,
    method: cap.method,
    chain: cap.chain,
    supportsWallet: knownWallet,
    supportsProtocolNative: cap.method !== 'link',
  };
}

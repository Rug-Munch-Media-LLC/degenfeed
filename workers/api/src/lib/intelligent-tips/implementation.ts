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


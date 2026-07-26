/**
 * @degenfeed/api-worker — OpenZeppelin Defender Integration
 *
 * Integrates with OpenZeppelin Defender for automated DAO operations:
 *   - Autotasks: Auto-execute passed proposals after timelock
 *   - Sentinels: Monitor for suspicious proposals
 *   - Upgrade management: Safe contract upgrades via Defender
 *   - Relay: Gas-optimized transaction submission through Defender Relay
 *
 * This module generates Defender configuration files and provides
 * API endpoints for managing Defender integrations.
 *
 * @see https://docs.openzeppelin.com/defender/
 */

import { badRequest, notFound, ok, serverError } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type DefenderNetwork =
  | 'mainnet'
  | 'goerli'
  | 'sepolia'
  | 'polygon-mainnet'
  | 'polygon-mumbai'
  | 'arbitrum-mainnet'
  | 'arbitrum-goerli'
  | 'optimism-mainnet'
  | 'optimism-goerli'
  | 'base-mainnet'
  | 'base-goerli'
  | 'avalanche-mainnet'
  | 'avalanche-fuji';

export type DefenderConfig = {};

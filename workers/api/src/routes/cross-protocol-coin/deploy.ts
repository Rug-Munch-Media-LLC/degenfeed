/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Deployment
 */

import type { Env } from '../../types';
import type { FeeConfig, VestingConfig } from './types';

/**
 * Deploy a creator coin on Base using the real deployer service.
 * Gates behind ENABLE_REAL_DEPLOYMENTS env var.
 */
export async function deployBaseCoin(
  creator: string,
  name: string,
  symbol: string,
  chain: 'base' | 'base_sepolia',
  vestingConfig: VestingConfig,
  feeConfig: FeeConfig,
  env: Env,
): Promise<{ coinAddress: string; tokenId: string }> {

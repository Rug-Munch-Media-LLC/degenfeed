/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Deployment
 */

import type { Env } from '../../index';
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
  const { deployCoin } = await import('../../lib/coin-deployer');

  const result = await deployCoin(
    {
      creator,
      name,
      symbol,
      chain,
      protocol: 'universal',
      metadataUri: `${env.APP_BASE_URL || 'https://app.degenfeed.xyz'}/coin/${symbol.toLowerCase()}`,
      vestingConfig,
      feeConfig,
    },
    env,
  );

  return { coinAddress: result.coinAddress, tokenId: result.tokenId };
}

/**
 * Deploy a creator coin on Solana using the real deployer service.
 * Gates behind ENABLE_REAL_DEPLOYMENTS env var.
 */
export async function deploySolanaToken(
  creator: string,
  name: string,
  symbol: string,
  chain: 'solana' | 'solana_devnet',
  vestingConfig: VestingConfig,
  feeConfig: FeeConfig,
  env: Env,
): Promise<{ coinAddress: string; tokenId: string }> {
  const { deployCoin } = await import('../../lib/coin-deployer');

  const result = await deployCoin(
    {
      creator,
      name,
      symbol,
      chain,
      protocol: 'universal',
      metadataUri: `${env.APP_BASE_URL || 'https://app.degenfeed.xyz'}/coin/${symbol.toLowerCase()}`,
      vestingConfig,
      feeConfig,
    },
    env,
  );

  return { coinAddress: result.coinAddress, tokenId: result.tokenId };
}

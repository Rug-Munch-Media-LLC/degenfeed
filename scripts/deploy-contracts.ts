#!/usr/bin/env tsx
/**
 * DegenFeed Creator Coin — Contract Deployment Script
 *
 * Deploys DegenFeedCoinV2 + DegenFeedDAOFactory to Base (mainnet or Sepolia),
 * verifies on Basescan, and outputs the deployed addresses.
 *
 * Usage:
 *   tsx scripts/deploy-contracts.ts --network base-sepolia   # Testnet
 *   tsx scripts/deploy-contracts.ts --network base            # Mainnet
 *
 * Environment:
 *   PREMIUM_WALLET_KEY=0x...  Deployer wallet private key
 *   EXPLORER_API_KEY=abc123   Basescan API key (optional, for verification)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type Address,
  type Chain,
  createWalletClient,
  formatEther,
  http,
  type PublicActions,
  parseEther,
  publicActions,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

// ─── Config ───────────────────────────────────────────────────────────────

interface NetworkConfig {
  name: string;
  chain: Chain;
  explorer: string;
  verifyApiUrl: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  'base-sepolia': {
    name: 'Base Sepolia',
    chain: baseSepolia,
    explorer: 'https://sepolia.basescan.org',
    verifyApiUrl: 'https://api-sepolia.basescan.org/api',
  },
  base: {
    name: 'Base',
    chain: base,
    explorer: 'https://basescan.org',
    verifyApiUrl: 'https://api.basescan.org/api',
  },
};

const ADDRESS_BOOK_PATH = resolve(
  import.meta.dirname ?? __dirname,
  '..',
  'packages',
  'creator-coin',
  'contracts',
  'addresses.ts',
);

// ─── ABI stubs — will be replaced with compiled artifacts ─────────────────
// Run: forge build --contracts packages/creator-coin/contracts/src

const DEGEN_FEED_COIN_V2_ABI = [
  {
    type: 'constructor' as const,
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'uri_', type: 'string' },
      { name: 'creator_', type: 'address' },
      { name: 'creatorAllocationBps_', type: 'uint256' },
      { name: 'creatorFeeBps_', type: 'uint256' },
      { name: 'platformFeeBps_', type: 'uint256' },
      { name: 'platformFeeReceiver_', type: 'address' },
      { name: 'referrer_', type: 'address' },
      { name: 'vestingDuration_', type: 'uint256' },
      { name: 'vestingCliff_', type: 'uint256' },
      { name: 'initialUnlockBps_', type: 'uint256' },
      { name: 'isLinearVesting_', type: 'bool' },
      { name: 'liquidityAllocationBps_', type: 'uint256' },
      { name: 'communityAllocationBps_', type: 'uint256' },
      { name: 'treasuryAllocationBps_', type: 'uint256' },
      { name: 'restrictTransfers_', type: 'bool' },
      { name: 'burnUnsoldOnGraduation_', type: 'bool' },
    ],
    stateMutability: 'nonpayable' as const,
  },
] as const;

const DAO_FACTORY_ABI = [
  {
    type: 'constructor' as const,
    inputs: [{ name: '_platformFeeReceiver', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
] as const;

// Placeholder bytecode paths — in production, compile with forge first
const COMPILED_OUT_DIR = resolve(import.meta.dirname ?? __dirname, '..', 'out');

type WalletClientWithPublic = ReturnType<typeof createWalletClient> & PublicActions;

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const networkFlag = args.find((a) => a.startsWith('--network='));
  const networkName = networkFlag?.split('=')[1] || 'base-sepolia';

  const config = NETWORKS[networkName];
  if (!config) {
    console.error(`Unknown network: ${networkName}`);
    console.error(`Available: ${Object.keys(NETWORKS).join(', ')}`);
    process.exit(1);
  }

  const privateKey = process.env.PREMIUM_WALLET_KEY;
  if (!privateKey) {
    console.error('❌ PREMIUM_WALLET_KEY environment variable is required');
    process.exit(1);
  }

  const explorerApiKey = process.env.EXPLORER_API_KEY;

  const deployer = privateKeyToAccount(privateKey as `0x${string}`);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Deploying DegenFeed Contracts to ${config.name}`);
  console.log(`═══════════════════════════════════════════\n`);

  const client = createWalletClient({
    account: deployer,
    chain: config.chain,
    transport: http(),
  }).extend(publicActions) as WalletClientWithPublic;

  // Check balance
  const balance = await client.getBalance({ address: deployer.address });
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${formatEther(balance)} ${config.chain.nativeCurrency.symbol}\n`);

  if (balance < parseEther('0.005')) {
    console.error(
      `❌ Insufficient balance. Need at least 0.005 ${config.chain.nativeCurrency.symbol}`,
    );
    process.exit(1);
  }

  // ── Step 1: Deploy DegenFeedCoinV2 (reference implementation) ─────
  console.log(`  ── Step 1/2: Deploying DegenFeedCoinV2 ──\n`);

  const coinV2Bytecode = await getCompiledBytecode('DegenFeedCoinV2.sol', 'DegenFeedCoinV2');

  if (!coinV2Bytecode) {
    console.log(`  ⚠️  No compiled bytecode found for DegenFeedCoinV2.

  To compile:
    1. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup
    2. cd packages/creator-coin/contracts && forge install && forge build
    3. Re-run this script

  Skipping on-chain deployment — will generate deploy plan instead.\n`);

    // Output deploy plan for manual execution
    console.log(`  ── Deploy Plan ──`);
    console.log(`  Network: ${config.name}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  DegenFeedCoinV2 constructor args:
    name_: "DegenFeedCoinV2"
    symbol_: "DFCV2"
    uri_: "https://degenfeed.xyz/coin/v2"
    creator_: ${deployer.address}
    creatorAllocationBps_: 1000 (10%)
    creatorFeeBps_: 100 (1%)
    platformFeeBps_: 50 (0.5%)
    platformFeeReceiver_: ${deployer.address}
    referrer_: address(0)
    vestingDuration_: 7776000 (90 days)
    vestingCliff_: 0
    initialUnlockBps_: 500 (5%)
    isLinearVesting_: true
    liquidityAllocationBps_: 6000 (60%)
    communityAllocationBps_: 2000 (20%)
    treasuryAllocationBps_: 500 (5%)
    restrictTransfers_: true
    burnUnsoldOnGraduation_: true`);

    console.log(`\n  DegenFeedDAOFactory constructor args:
    _platformFeeReceiver: ${deployer.address}\n`);

    // Write the deploy plan to a file
    const planPath = resolve(import.meta.dirname ?? __dirname, '..', 'deploy-plan.json');
    writeFileSync(
      planPath,
      JSON.stringify(
        {
          network: networkName,
          deployer: deployer.address,
          contracts: {
            DegenFeedCoinV2: {
              constructorArgs: [
                'DegenFeedCoinV2',
                'DFCV2',
                'https://degenfeed.xyz/coin/v2',
                deployer.address,
                1000n, // creatorAllocationBps
                100n, // creatorFeeBps
                50n, // platformFeeBps
                deployer.address,
                '0x0000000000000000000000000000000000000000',
                7776000n, // vestingDuration (90 days)
                0n, // vestingCliff
                500n, // initialUnlockBps
                true, // isLinearVesting
                6000n, // liquidityAllocationBps
                2000n, // communityAllocationBps
                500n, // treasuryAllocationBps
                true, // restrictTransfers
                true, // burnUnsoldOnGraduation
              ],
            },
            DegenFeedDAOFactory: {
              constructorArgs: [deployer.address],
            },
          },
        },
        null,
        2,
      ),
    );
    console.log(`  📝 Deploy plan written to deploy-plan.json\n`);
    return;
  }

  // ── Deploy DegenFeedCoinV2 ────────────────────────────────────────
  let coinV2Address: Address;
  try {
    const params = {
      abi: DEGEN_FEED_COIN_V2_ABI,
      bytecode: coinV2Bytecode as `0x${string}`,
      args: [
        'DegenFeedCoinV2', // name
        'DFCV2', // symbol
        'https://degenfeed.xyz/coin/v2', // uri
        deployer.address, // creator
        1000n, // creatorAllocationBps (10%)
        100n, // creatorFeeBps (1%)
        50n, // platformFeeBps (0.5%)
        deployer.address, // platformFeeReceiver
        '0x0000000000000000000000000000000000000000' as Address, // referrer
        7_776_000n, // vestingDuration (90 days)
        0n, // vestingCliff
        500n, // initialUnlockBps (5%)
        true, // isLinearVesting
        6000n, // liquidityAllocationBps (60%)
        2000n, // communityAllocationBps (20%)
        500n, // treasuryAllocationBps (5%)
        true, // restrictTransfers
        true, // burnUnsoldOnGraduation
      ] as const,
    };

    const hash = await client.deployContract(params);
    console.log(`  Tx: ${config.explorer}/tx/${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });
    coinV2Address =
      receipt.contractAddress ?? ('0x0000000000000000000000000000000000000000' as Address);

    if (coinV2Address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Failed to get DegenFeedCoinV2 address from receipt');
    }
    console.log(`  ✅ DegenFeedCoinV2: ${config.explorer}/address/${coinV2Address}\n`);

    // Verify
    if (explorerApiKey) {
      await verifyContract(
        config.verifyApiUrl,
        explorerApiKey,
        coinV2Address,
        'DegenFeedCoinV2',
        JSON.stringify([...(params.args as unknown as [])]),
      );
    }
  } catch (err) {
    console.error(
      '❌ DegenFeedCoinV2 deployment failed:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  // ── Step 2: Deploy DegenFeedDAOFactory ─────────────────────────────
  console.log(`  ── Step 2/2: Deploying DegenFeedDAOFactory ──\n`);

  const factoryBytecode = await getCompiledBytecode(
    'dao/DegenFeedDAOFactory.sol',
    'DegenFeedDAOFactory',
  );

  if (!factoryBytecode) {
    console.log('  ⚠️  No compiled bytecode for DegenFeedDAOFactory. Skipping.\n');
    // Still save the partial result
    saveAddresses(networkName, coinV2Address, undefined);
    return;
  }

  let factoryAddress: Address | undefined;
  try {
    const hash = await client.deployContract({
      abi: DAO_FACTORY_ABI,
      bytecode: factoryBytecode as `0x${string}`,
      args: [deployer.address] as const,
    });
    console.log(`  Tx: ${config.explorer}/tx/${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });
    factoryAddress = receipt.contractAddress as Address | undefined;

    if (factoryAddress) {
      console.log(`  ✅ DegenFeedDAOFactory: ${config.explorer}/address/${factoryAddress}\n`);

      if (explorerApiKey) {
        await verifyContract(
          config.verifyApiUrl,
          explorerApiKey,
          factoryAddress,
          'DegenFeedDAOFactory',
          JSON.stringify([deployer.address]),
        );
      }
    }
  } catch (err) {
    console.warn(
      '⚠️  DegenFeedDAOFactory deployment failed:',
      err instanceof Error ? err.message : err,
    );
  }

  // ── Save addresses ─────────────────────────────────────────────────
  saveAddresses(networkName, coinV2Address, factoryAddress);

  console.log(`  ───────────────────────────────────────`);
  console.log(`  Deployment complete!`);
  console.log(`  DegenFeedCoinV2:     ${coinV2Address}`);
  console.log(`  DegenFeedDAOFactory: ${factoryAddress || 'NOT DEPLOYED'}`);
  console.log(`  Network: ${config.name}`);
  console.log(`  Explorer: ${config.explorer}`);
  console.log(`  ───────────────────────────────────────\n`);
}

function saveAddresses(network: string, coinV2: Address, factory?: Address) {
  const content = `/**
 * Auto-generated contract addresses for DegenFeed Creator Coin.
 * Generated by scripts/deploy-contracts.ts
 * 
 * Do not edit manually — re-run the deploy script to update.
 */

export const CONTRACT_ADDRESSES: Record<string, { coinV2: string; factory?: string }> = {
  '${network}': {
    coinV2: '${coinV2}',
    ${factory ? `factory: '${factory}',` : '// factory: not deployed'}
  },
} as const;

export const DEFAULT_CHAIN = '${network}';
`;

  try {
    writeFileSync(ADDRESS_BOOK_PATH, content, 'utf-8');
    console.log(`  📝 Addresses saved to ${ADDRESS_BOOK_PATH}`);
  } catch (err) {
    console.warn(`  ⚠️  Could not save address book:`, err instanceof Error ? err.message : err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getCompiledBytecode(
  contractFile: string,
  contractName: string,
): Promise<string | null> {
  // Try Foundry output format: out/{contractFile}/{contractName}.json
  const paths = [
    resolve(COMPILED_OUT_DIR, contractFile, `${contractName}.json`),
    resolve(COMPILED_OUT_DIR, contractName, `${contractName}.json`),
  ];

  for (const outPath of paths) {
    try {
      const artifact = JSON.parse(readFileSync(outPath, 'utf-8')) as {
        bytecode?: { object?: string };
      };
      const bytecode = artifact.bytecode?.object;
      if (bytecode && bytecode !== '0x') return bytecode;
    } catch {
      // Try next path
    }
  }
  return null;
}

async function verifyContract(
  apiUrl: string,
  apiKey: string,
  contractAddress: string,
  contractName: string,
  constructorArgs: string,
): Promise<boolean> {
  // Path to Solidity source
  const sourcePath = resolve(
    import.meta.dirname ?? __dirname,
    '..',
    'packages',
    'creator-coin',
    'contracts',
    'src',
    contractName.includes('DAOFactory') ? 'dao' : '',
    `${contractName}.sol`,
  );

  let sourceCode: string;
  try {
    sourceCode = readFileSync(sourcePath, 'utf-8');
  } catch {
    console.warn(`  ⚠️  Solidity source not found at ${sourcePath}`);
    return false;
  }

  const body = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode,
    codeformat: 'solidity-single-file',
    contractname: contractName,
    compilerversion: 'v0.8.26+commit.8a97fa7a',
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: constructorArgs,
    apikey: apiKey,
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = (await response.json()) as { status?: string; message?: string };
    if (data.status === '1') {
      console.log(`  ✅ ${contractName} verified on block explorer`);
    } else {
      console.warn(`  ⚠️  ${contractName} verification: ${data.message || 'unknown'}`);
    }
    return data.status === '1';
  } catch (err) {
    console.warn(`  ⚠️  Verification request failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal deployment error:', err);
  process.exit(1);
});

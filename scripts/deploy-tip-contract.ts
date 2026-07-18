#!/usr/bin/env tsx
/**
 * DegenFeed Tips — Deployment Script
 *
 * Deploys the DegenFeedTips contract to Base, Optimism, and Arbitrum,
 * verifies on each chain's block explorer, and updates the address book.
 *
 * Usage:
 *   tsx scripts/deploy-tip-contract.ts --network base
 *   tsx scripts/deploy-tip-contract.ts --network optimism
 *   tsx scripts/deploy-tip-contract.ts --network arbitrum
 *   tsx scripts/deploy-tip-contract.ts --all          # deploy to all three
 *
 * Prerequisites:
 *   - Install viem: pnpm add -w viem
 *   - Set PRIVATE_KEY env var (the deployer's wallet private key)
 *   - Set EXPLORER_API_KEY env var (Etherscan/Basescan/Arbiscan API key)
 *   - Fund the deployer wallet on each target L2
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, base, optimism } from 'viem/chains';

// ─── Config ───────────────────────────────────────────────────────────────

interface NetworkConfig {
  name: string;
  chain: typeof base;
  explorer: string;
  verifyApiUrl: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  base: {
    name: 'Base',
    chain: base,
    explorer: 'https://basescan.org',
    verifyApiUrl: 'https://api.basescan.org/api',
  },
  optimism: {
    name: 'Optimism',
    chain: optimism,
    explorer: 'https://optimistic.etherscan.io',
    verifyApiUrl: 'https://api-optimistic.etherscan.io/api',
  },
  arbitrum: {
    name: 'Arbitrum One',
    chain: arbitrum,
    explorer: 'https://arbiscan.io',
    verifyApiUrl: 'https://api.arbiscan.io/api',
  },
};

const CONTRACT_SOURCE_PATH = resolve(
  import.meta.dirname ?? __dirname,
  '..',
  'packages',
  'tip-contract',
  'src',
  'index.ts',
);

const ADDRESS_BOOK_PATH = CONTRACT_SOURCE_PATH;

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const deployAll = args.includes('--all');
  const networkFlag = args.find((a) => a.startsWith('--network='));
  const networkName = networkFlag?.split('=')[1];

  const targets: string[] = [];
  if (deployAll) {
    targets.push(...Object.keys(NETWORKS));
  } else if (networkName && NETWORKS[networkName]) {
    targets.push(networkName);
  } else {
    console.error(`
Usage:
  tsx scripts/deploy-tip-contract.ts --network base
  tsx scripts/deploy-tip-contract.ts --network optimism
  tsx scripts/deploy-tip-contract.ts --network arbitrum
  tsx scripts/deploy-tip-contract.ts --all

Environment:
  PRIVATE_KEY=0x...         Deployer wallet private key
  EXPLORER_API_KEY=abc123   Etherscan/Basescan/Arbiscan API key
`);
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const explorerApiKey = process.env.EXPLORER_API_KEY;
  if (!explorerApiKey) {
    console.warn('⚠️  EXPLORER_API_KEY not set — contracts will not be verified automatically');
  }

  const deployer = privateKeyToAccount(privateKey as `0x${string}`);

  for (const network of targets) {
    await deployToNetwork(network, NETWORKS[network]!, deployer, explorerApiKey);
  }
}

// ─── Deploy ───────────────────────────────────────────────────────────────

async function deployToNetwork(
  networkKey: string,
  config: NetworkConfig,
  deployer: ReturnType<typeof privateKeyToAccount>,
  explorerApiKey: string | undefined,
) {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Deploying DegenFeedTips to ${config.name}`);
  console.log(`═══════════════════════════════════════════\n`);

  // Build the client
  const client = createWalletClient({
    account: deployer,
    chain: config.chain,
    transport: http(),
  }).extend(publicActions);

  // Get deployer balance
  const balance = await client.getBalance({ address: deployer.address });
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${formatEther(balance)} ${config.chain.nativeCurrency.symbol}\n`);

  if (balance < parseEther('0.001')) {
    console.error(
      `❌ Insufficient balance on ${config.name}. Need at least 0.001 ${config.chain.nativeCurrency.symbol}`,
    );
    return;
  }

  // ── Compile & deploy ──────────────────────────────────────────────────
  // In production, use forge (foundry) or hardhat to compile first.
  // This script assumes the bytecode is pre-compiled or uses a simulative
  // approach. For a real deployment, replace with:
  //   const bytecode = readFileSync('out/DegenFeedTips.sol/DegenFeedTips.json');
  //   const abi = bytecode.abi;

  // Placeholder: actual compilation should happen with:
  //   forge build --contracts packages/tip-contract/src/DegenFeedTips.sol
  //
  // For now, we simulate the deployment hash. In production:
  //   1. Write DegenFeedTips.sol to packages/tip-contract/src/
  //   2. Run: forge install && forge build
  //   3. Import the compiled artifact

  const bytecode = process.env.CI
    ? ('0x' as const) // CI stub — replace with actual compiled bytecode
    : await getCompiledBytecode();

  if (!bytecode || bytecode === '0x') {
    console.log(`
  ⚠️  No compiled bytecode found.

  To compile:
    1. Save packages/tip-contract/src/DegenFeedTips.sol (copy from @degenfeed/tip-contract TIP_CONTRACT_SOURCE)
    2. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup
    3. Build: forge build --contracts packages/tip-contract/src/DegenFeedTips.sol
    4. Re-run this script

  Skipping deployment to ${config.name}...
`);
    return;
  }

  console.log(`  Deploying contract...`);

  let _txHash: string;
  let contractAddress: string;

  try {
    // Deploy the contract
    const hash = await client.deployContract({
      abi: getContractAbi(),
      bytecode: bytecode as `0x${string}`,
    });

    _txHash = hash;
    console.log(`  Tx submitted: ${config.explorer}/tx/${hash}`);

    // Wait for transaction receipt
    const receipt = await client.waitForTransactionReceipt({ hash });
    contractAddress = receipt.contractAddress ?? '';

    if (!contractAddress) {
      console.error('❌ Failed to get contract address from receipt');
      return;
    }
  } catch (err) {
    console.error(`❌ Deployment failed:`, err instanceof Error ? err.message : err);
    return;
  }

  console.log(`  ✅ Deployed to ${config.explorer}/address/${contractAddress}\n`);

  // ── Verify on block explorer ──────────────────────────────────────────
  if (explorerApiKey) {
    console.log(`  Verifying contract...`);
    try {
      const verifyResult = await verifyContract(
        config.verifyApiUrl,
        explorerApiKey,
        contractAddress,
        networkKey,
      );
      if (verifyResult) {
        console.log(`  ✅ Contract verified on ${config.explorer}\n`);
      } else {
        console.warn(`  ⚠️  Verification may have failed. Check manually.\n`);
      }
    } catch (err) {
      console.warn(`  ⚠️  Verification error:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Update address book ───────────────────────────────────────────────
  updateAddressBook(networkKey, contractAddress as `0x${string}`);

  console.log(`  ───────────────────────────────────────`);
  console.log(`  ${config.name} deployment complete!`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Explorer: ${config.explorer}/address/${contractAddress}`);
  console.log(`  ───────────────────────────────────────\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatEther(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(6);
}

function parseEther(eth: string): bigint {
  return BigInt(Math.floor(Number.parseFloat(eth) * 1e18));
}

/**
 * Read the compiled bytecode from Foundry's output directory.
 * Adjust path to match your project setup.
 */
async function getCompiledBytecode(): Promise<string | null> {
  try {
    const outPath = resolve(
      import.meta.dirname ?? __dirname,
      '..',
      'out',
      'DegenFeedTips.sol',
      'DegenFeedTips.json',
    );
    const artifact = JSON.parse(readFileSync(outPath, 'utf-8')) as {
      bytecode?: { object?: string };
    };
    return artifact.bytecode?.object ?? null;
  } catch {
    return null;
  }
}

/**
 * Minimal ABI needed for deployment (just the constructor).
 */
function getContractAbi() {
  return [
    {
      type: 'constructor' as const,
      inputs: [],
      stateMutability: 'nonpayable' as const,
    },
  ];
}

/**
 * Submit contract source to Etherscan-like API for verification.
 */
async function verifyContract(
  apiUrl: string,
  apiKey: string,
  contractAddress: string,
  _networkKey: string,
): Promise<boolean> {
  // Read the Solidity source
  const sourcePath = resolve(
    import.meta.dirname ?? __dirname,
    '..',
    'packages',
    'tip-contract',
    'src',
    'DegenFeedTips.sol',
  );

  let sourceCode: string;
  try {
    sourceCode = readFileSync(sourcePath, 'utf-8');
  } catch {
    console.warn('  ⚠️  Solidity source not found at', sourcePath);
    return false;
  }

  const body = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode,
    codeformat: 'solidity-single-file',
    contractname: 'DegenFeedTips',
    compilerversion: 'v0.8.20+commit.a1b79de6',
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: '',
    apikey: apiKey,
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = (await response.json()) as { status?: string; message?: string; result?: string };
    return data.status === '1';
  } catch {
    return false;
  }
}

/**
 * Update the TIP_CONTRACT_ADDRESSES export in the tip-contract package.
 */
function updateAddressBook(networkKey: string, address: `0x${string}`) {
  try {
    const content = readFileSync(ADDRESS_BOOK_PATH, 'utf-8');

    // Find and replace the address for the given network
    const regex = new RegExp(`(${networkKey}:\\s*)'[^']*'`);
    const updated = content.replace(regex, `$1'${address}'`);

    if (updated !== content) {
      writeFileSync(ADDRESS_BOOK_PATH, updated, 'utf-8');
      console.log(
        `  📝 Updated TIP_CONTRACT_ADDRESSES.${networkKey} in packages/tip-contract/src/index.ts`,
      );
    } else {
      console.warn(`  ⚠️  Could not find ${networkKey} entry in address book. Update manually.`);
    }
  } catch (err) {
    console.error('  ❌ Failed to update address book:', err instanceof Error ? err.message : err);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

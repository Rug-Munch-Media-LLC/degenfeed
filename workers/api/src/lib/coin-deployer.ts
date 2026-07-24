/**
 * @degenfeed/api-worker — Creator Coin Deployer Service
 *
 * Real contract deployment service for creator coins.
 * Supports Base (EVM via viem) and Solana (via @solana/web3.js + Anchor IDL).
 *
 * Delegates to the @degenfeed/creator-coin SDK for chain-specific logic.
 * Adds production safety: gas estimation, transaction simulation,
 * feature-flag gating, and KV deployment tracking.
 *
 * NOTE: Solana deployer requires optional deps:
 *   @solana/web3.js, @solana/spl-token, @coral-xyz/anchor, @degenfeed/creator-coin
 * These are dynamically imported and only needed when deploying to Solana.
 *
 * Feature flag: ENABLE_REAL_DEPLOYMENTS=false → returns "coming soon" message
 * Feature flag: ENABLE_REAL_DEPLOYMENTS=true  → deploys real contracts
 */

import { type Address, createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { Env } from '../index';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DeployCoinInput {
  /** Creator wallet address (lowercase) */
  creator: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Target chain */
  chain: 'base' | 'solana';
  /** Origin protocol (farcaster, lens, nostr, etc.) */
  protocol: 'farcaster' | 'lens' | 'universal';
  /** Metadata URI (IPFS or HTTP) */
  metadataUri?: string;
  /** Vesting configuration (optional fields) */
  vestingConfig?: {
    vestingDurationDays?: number;
    creatorAllocationBps?: number;
    cliffDays?: number;
  };
  /** Fee configuration (optional fields) */
  feeConfig?: {
    creatorFeeBps?: number;
    platformFeeBps?: number;
  };
}

export interface DeployCoinResult {
  /** Transaction hash/signature */
  txHash: string;
  /** Deployed token address (contract address on Base, mint on Solana) */
  coinAddress: string;
  /** Token ID on Zora (only for Base deployments) */
  tokenId: string;
  /** Chain deployed on */
  chain: string;
  /** Explorer URL */
  explorerUrl: string;
  /** Status of the deployment */
  status: 'confirmed' | 'pending' | 'failed';
  /** Error message if failed */
  error?: string;
}

interface DeployRecord {
  status: 'pending' | 'confirmed' | 'failed';
  txHash: string;
  coinAddress: string;
  chain: string;
  creator: string;
  symbol: string;
  name: string;
  protocol: string;
  deployedAt: number;
  error?: string;
  confirmations?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TTL_30_DAYS = 60 * 60 * 24 * 30;
const TTL_1Y = 60 * 60 * 24 * 365;

// Default Zora factory address (Base mainnet)
const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214F9DF38E35BF45baF3';

// ─── Error Types ───────────────────────────────────────────────────────────

export class CoinDeployError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'CoinDeployError';
  }
}

class DeployerFeatureDisabled extends CoinDeployError {
  constructor() {
    super('Creator coin deployments coming soon. Join the waitlist.', 'FEATURE_NOT_ENABLED');
    this.name = 'DeployerFeatureDisabled';
  }
}

class DeployerConfigError extends CoinDeployError {
  constructor(detail: string) {
    super(`Deployer configuration error: ${detail}`, 'DEPLOYER_CONFIG_ERROR');
    this.name = 'DeployerConfigError';
  }
}

class DeployerChainError extends CoinDeployError {
  constructor(chain: string, detail: string) {
    super(`Chain ${chain} deploy error: ${detail}`, 'CHAIN_DEPLOY_ERROR');
    this.name = 'DeployerChainError';
  }
}

// ─── Main Deployer ─────────────────────────────────────────────────────────

/**
 * Deploy a creator coin on the specified chain.
 *
 * Gates behind ENABLE_REAL_DEPLOYMENTS env var.
 * When disabled, returns a clear "coming soon" error.
 */
export async function deployCoin(input: DeployCoinInput, env: Env): Promise<DeployCoinResult> {
  // ── Feature flag gate ────────────────────────────────────────────────
  if (env.ENABLE_REAL_DEPLOYMENTS !== 'true') {
    throw new DeployerFeatureDisabled();
  }

  // ── Validate input ───────────────────────────────────────────────────
  if (!input.creator || !input.name || !input.symbol) {
    throw new DeployerConfigError('creator, name, and symbol are required');
  }

  if (input.chain !== 'base' && input.chain !== 'solana') {
    throw new DeployerConfigError(`Unsupported chain: ${input.chain}. Must be 'base' or 'solana'`);
  }

  if (!env.PREMIUM_WALLET_KEY) {
    throw new DeployerConfigError('PREMIUM_WALLET_KEY is not configured');
  }

  // ── Record pending deployment in KV ──────────────────────────────────
  const deployKey = `deploy:${input.creator}:${Date.now()}`;
  const pendingRecord: DeployRecord = {
    status: 'pending',
    txHash: '',
    coinAddress: '',
    chain: input.chain,
    creator: input.creator,
    symbol: input.symbol,
    name: input.name,
    protocol: input.protocol,
    deployedAt: Date.now(),
  };

  try {
    await kvPutJson(env.DEPLOYMENTS, deployKey, pendingRecord);
  } catch (err) {
    console.warn('[coin-deployer] Failed to record pending deployment:', String(err));
  }

  try {
    // ── Route to chain-specific deployer ────────────────────────────────
    let result: DeployCoinResult;

    if (input.chain === 'base') {
      result = await deployToBase(input, env);
    } else {
      result = await deployToSolana(input, env);
    }

    // ── Update KV record with success ─────────────────────────────────
    const confirmedRecord: DeployRecord = {
      ...pendingRecord,
      status: 'confirmed',
      txHash: result.txHash,
      coinAddress: result.coinAddress,
    };

    await kvPutJson(env.DEPLOYMENTS, deployKey, confirmedRecord);

    // Also store symbol → coinAddress index
    const symbolKey = `coin:symbol:${input.symbol.toLowerCase()}`;
    try {
      await env.CACHE?.put(
        symbolKey,
        JSON.stringify({
          coinAddress: result.coinAddress,
          chain: input.chain,
          originProtocol: input.protocol,
          originCreatorId: input.creator,
        }),
        { expirationTtl: TTL_1Y },
      );
    } catch {
      // Non-critical
    }

    console.log(
      `[coin-deployer] Deployed ${input.name} ($${input.symbol}) on ${input.chain} ` +
        `at ${result.coinAddress} | tx: ${result.txHash}`,
    );

    return result;
  } catch (err) {
    // ── Update KV record with failure ──────────────────────────────────
    const failedRecord: DeployRecord = {
      ...pendingRecord,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
    try {
      await kvPutJson(env.DEPLOYMENTS, deployKey, failedRecord);
    } catch {
      // Non-critical
    }

    throw err instanceof CoinDeployError
      ? err
      : new CoinDeployError(
          `Deployment failed: ${err instanceof Error ? err.message : String(err)}`,
          'DEPLOY_FAILED',
          err,
        );
  }
}

// ─── Base/EVM Deployer ─────────────────────────────────────────────────────

async function deployToBase(input: DeployCoinInput, env: Env): Promise<DeployCoinResult> {
  const privateKey = env.PREMIUM_WALLET_KEY as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  // Resolve factory address: env var > our constants
  const factoryAddress = (env.COIN_FACTORY_ADDRESS || ZORA_FACTORY_ADDRESS) as Address;

  const creatorAllocationBps = BigInt(input.vestingConfig?.creatorAllocationBps ?? 500);
  const creatorFeeBps = BigInt(input.feeConfig?.creatorFeeBps ?? 100);
  const platformFeeBps = BigInt(input.feeConfig?.platformFeeBps ?? 50);

  console.log(
    `[coin-deployer] Deploying to Base via factory ${factoryAddress}...`,
    JSON.stringify({
      name: input.name,
      symbol: input.symbol,
      creatorAllocationBps: creatorAllocationBps.toString(),
      creatorFeeBps: creatorFeeBps.toString(),
      platformFeeBps: platformFeeBps.toString(),
    }),
  );

  // Use the Zora protocol factory ABI for deployment
  const factoryAbi = [
    {
      type: 'function' as const,
      name: 'deploy',
      inputs: [
        {
          type: 'tuple' as const,
          components: [
            { name: 'creator', type: 'address' as const },
            { name: 'name', type: 'string' as const },
            { name: 'symbol', type: 'string' as const },
            { name: 'uri', type: 'string' as const },
            { name: 'creatorAllocationBps', type: 'uint256' as const },
            { name: 'creatorFeeBps', type: 'uint256' as const },
            { name: 'platformFeeBps', type: 'uint256' as const },
            { name: 'referrer', type: 'address' as const },
          ],
        },
      ],
      outputs: [{ name: 'coin', type: 'address' as const }],
      stateMutability: 'payable' as const,
    },
  ] as const;

  // Step 1: Simulate the transaction first
  console.log('[coin-deployer] Simulating deployment transaction...');
  const { request: call } = await publicClient.simulateContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: 'deploy',
    args: [
      {
        creator: input.creator as Address,
        name: input.name,
        symbol: input.symbol,
        uri: input.metadataUri || `https://app.degenfeed.xyz/coin/${input.symbol.toLowerCase()}`,
        creatorAllocationBps,
        creatorFeeBps,
        platformFeeBps,
        referrer: '0x0000000000000000000000000000000000000000' as Address,
      },
    ],
    value: parseEther('0.05'),
    account: account.address,
  });

  // Step 2: Send the transaction
  console.log('[coin-deployer] Sending deployment transaction...');
  const hash = await walletClient.writeContract(call);

  // Step 3: Wait for confirmation
  console.log(`[coin-deployer] Waiting for confirmation: tx ${hash}...`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000, // 2 minute timeout
  });

  if (receipt.status === 'reverted') {
    throw new DeployerChainError('base', `Transaction reverted. Hash: ${hash}`);
  }

  // Extract the deployed contract address from the logs
  // The CoinCreated event is emitted, and the new contract address is typically
  // the first log's address or the `coin` return value
  const coinAddress = receipt.logs[0]?.address ?? '0x0000000000000000000000000000000000000000';

  if (coinAddress === '0x0000000000000000000000000000000000000000') {
    throw new DeployerChainError('base', 'Could not determine deployed coin address from receipt');
  }

  console.log(`[coin-deployer] ✅ Deployed at ${coinAddress} (tx: ${hash})`);

  return {
    txHash: hash,
    coinAddress: coinAddress.toLowerCase(),
    tokenId: '1', // First token for this creator on Zora
    chain: 'base',
    explorerUrl: `https://basescan.org/tx/${hash}`,
    status: 'confirmed',
  };
}

// ─── Solana Deployer ───────────────────────────────────────────────────────

async function deployToSolana(input: DeployCoinInput, env: Env): Promise<DeployCoinResult> {
  // Dynamic imports for Solana deps (not always available in Workers env)
  // Uses inline require to avoid TS module resolution for optional deps
  let solanaWeb3: any;
  let anchor: any;
  let CreatorCoinSolanaClient: any;

  try {
    solanaWeb3 = await import('@solana/web3.js');
    // @ts-expect-error — optional dependency, installed alongside @degenfeed/creator-coin
    anchor = await import('@coral-xyz/anchor');
    const creatorCoin = await import('@degenfeed/creator-coin');
    CreatorCoinSolanaClient = creatorCoin.CreatorCoinSolanaClient;
  } catch {
    throw new DeployerConfigError(
      'Solana dependencies not available. Install: @solana/web3.js, @coral-xyz/anchor, @solana/spl-token, @degenfeed/creator-coin',
    );
  }

  const rpcUrl = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const privateKeyBytes = extractSolanaPrivateKey(env.PREMIUM_WALLET_KEY || '');

  const connection = new solanaWeb3.Connection(rpcUrl, 'confirmed');
  const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

  // Create an Anchor provider from the keypair
  const provider = new anchor.AnchorProvider(
    connection,
    {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(keypair);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        for (const tx of txs) tx.partialSign(keypair);
        return txs;
      },
    } as any,
    { commitment: 'confirmed' },
  );

  const client = new CreatorCoinSolanaClient(provider);

  console.log(
    `[coin-deployer] Deploying to Solana...`,
    JSON.stringify({
      name: input.name,
      symbol: input.symbol,
      creator: keypair.publicKey.toBase58(),
    }),
  );

  try {
    const sig = await client.deployCoin({
      name: input.name,
      symbol: input.symbol,
      uri: input.metadataUri || `https://app.degenfeed.xyz/coin/${input.symbol.toLowerCase()}`,
      creator: keypair.publicKey.toBase58(),
      chain: 'solana',
      creatorAllocationBps: input.vestingConfig?.creatorAllocationBps ?? 500,
      creatorFeeBps: input.feeConfig?.creatorFeeBps ?? 100,
      platformFeeBps: input.feeConfig?.platformFeeBps ?? 50,
    });

    return {
      txHash: sig.txHash,
      coinAddress: sig.primaryAddress,
      tokenId: '1',
      chain: 'solana',
      explorerUrl: `https://solscan.io/tx/${sig.txHash}`,
      status: 'confirmed',
    };
  } catch (err) {
    throw new DeployerChainError(
      'solana',
      `Solana deploy failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Deployment Status Query ───────────────────────────────────────────────

/**
 * Look up a deployment record by transaction hash or creator address.
 */
export async function getDeployStatus(
  env: Env,
  query: { txHash?: string; creator?: string; limit?: number },
): Promise<DeployRecord | DeployRecord[] | null> {
  if (!env.DEPLOYMENTS) return null;

  try {
    // If txHash is provided, scan for matching record
    if (query.txHash) {
      return await findByTxHash(env.DEPLOYMENTS, query.txHash);
    }

    // If creator is provided, list recent deploys for that wallet
    if (query.creator) {
      const prefix = `deploy:${query.creator.toLowerCase()}:`;
      return await findByPrefix(env.DEPLOYMENTS, prefix, query.limit ?? 10);
    }

    return null;
  } catch (err) {
    console.warn('[coin-deployer] Status query failed:', String(err));
    return null;
  }
}

async function findByTxHash(kv: KVNamespace, txHash: string): Promise<DeployRecord | null> {
  // Scan through KV — in production use an index
  // For Cloudflare Workers, we list with prefix and search
  let cursor: string | undefined;
  const lowerTxHash = txHash.toLowerCase();

  for (let i = 0; i < 10; i++) {
    const page = await kv.list({ prefix: 'deploy:', cursor, limit: 100 });
    for (const key of page.keys) {
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;
        const record = JSON.parse(raw) as DeployRecord;
        if (record.txHash.toLowerCase() === lowerTxHash) {
          return record;
        }
      } catch {}
    }
    cursor = page.list_complete ? undefined : page.cursor;
    if (!cursor) break;
  }

  return null;
}

async function findByPrefix(
  kv: KVNamespace,
  prefix: string,
  limit: number,
): Promise<DeployRecord[]> {
  const results: DeployRecord[] = [];
  let cursor: string | undefined;

  for (let i = 0; i < 5 && results.length < limit; i++) {
    const page = await kv.list({ prefix, cursor, limit: 100 });
    for (const key of page.keys) {
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;
        results.push(JSON.parse(raw) as DeployRecord);
      } catch {
        continue;
      }
      if (results.length >= limit) break;
    }
    cursor = page.list_complete ? undefined : page.cursor;
    if (!cursor) break;
  }

  return results.slice(0, limit);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractSolanaPrivateKey(key: string): Uint8Array {
  // Support both base58-encoded and hex-encoded private keys
  const cleanKey = key.trim();

  // Try hex first (most common for env vars: 0x-prefixed 64-byte key or raw 64-byte hex)
  const hex = cleanKey.startsWith('0x') ? cleanKey.slice(2) : cleanKey;
  if (/^[0-9a-fA-F]{128}$/.test(hex)) {
    const bytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    // 32-byte key (secret key only, no public key)
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  // Try base58 (requires bs58 package)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bs58 = require('bs58');
    const decoded = bs58.decode(cleanKey);
    if (decoded.length === 64 || decoded.length === 32) return decoded;
  } catch {
    // bs58 not available or invalid encoding
  }

  throw new DeployerConfigError(
    'Unable to parse Solana private key. ' +
      'Expected 64-byte hex (128 hex chars), 32-byte hex (64 hex chars), or base58-encoded keypair.',
  );
}

async function kvPutJson(kv: KVNamespace | undefined, key: string, value: unknown): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: TTL_30_DAYS });
  } catch (err) {
    console.warn(`[coin-deployer] KV put failed for ${key}:`, String(err));
  }
}

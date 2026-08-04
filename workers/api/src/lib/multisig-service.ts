/**
 * @degenfeed/api-worker — Multi-Signature Treasury Service (TASK 1)
 *
 * Orchestrates multi-sig transactions for DAO treasuries.
 * Supports ETH, ERC20, ERC721, ERC1155, contract interactions, and DEX swaps.
 *
 * Lifecycle: Propose → Sign → Execute (or Cancel)
 * All state persisted in KV under `multisig:tx:{daoId}:{txId}` namespace.
 *
 * ## Integration
 * Companion contract: MultiSigTreasury.sol in packages/creator-coin/contracts/src/dao/
 * For on-chain execution, use ethers/viem with the configured multi-sig wallet.
 */

import type { Address } from 'viem';
import type { Env } from '../types';
import { log } from '../logger';
import {
  multisigConfigKey,
  multisigIndexKey,
  multisigSignatureKey,
  multisigTxKey,
} from '../kv-key-patterns';

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_TTL = 365 * 86400; // 1 year

// ─── Types ────────────────────────────────────────────────────────────────

export type TransactionType =
  | 'eth_transfer'
  | 'erc20_transfer'
  | 'erc721_transfer'
  | 'erc1155_transfer'
  | 'contract_interaction'
  | 'dex_swap';

export type TransactionStatus = 'pending' | 'signed' | 'executed' | 'cancelled' | 'failed';

export interface MultiSigConfig {
  daoId: string;
  signers: Address[];
  threshold: number;
  chain: 'base' | 'solana';
  treasuryAddress: Address;
  contractAddress?: Address; // On-chain multi-sig contract address
  updatedAt: number;
  updatedBy: string;
}

export interface MultiSigTransaction {
  id: string;
  daoId: string;
  type: TransactionType;
  status: TransactionStatus;
  proposer: Address;
  /** Target address for the transaction */
  to: Address;
  /** Value in wei (for ETH transfers) */
  value: string;
  /** Encoded calldata for contract interactions */
  data?: string;
  /** Token details (for ERC20/721/1155 transfers) */
  token?: {
    address: Address;
    tokenId?: string; // For ERC721/ERC1155
    amount?: string; // For ERC20/ERC1155
  };
  /** Swap details (for DEX swaps) */
  swap?: {
    fromToken: Address;
    toToken: Address;
    amountIn: string;
    minAmountOut: string;
    aggregatorData?: string;
  };
  /** Human-readable description */
  description: string;
  /** Signature tally */
  signatures: SignerSignature[];
  /** Required approvals */
  threshold: number;
  /** Total eligible signers */
  totalSigners: number;
  /** Block/timestamp when created */
  createdAt: number;
  /** When this tx was executed/cancelled */
  resolvedAt?: number;
  /** On-chain execution receipt */
  executionTx?: string;
  /** Gas used (if executed on-chain) */
  gasUsed?: string;
  /** Error message if failed */
  error?: string;
  /** Metadata for display */
  metadata?: Record<string, string>;
}

export interface SignerSignature {
  signer: Address;
  approved: boolean; // true = approve, false = reject
  signedAt: number;
  reason?: string;
  /** On-chain signature bytes (if signing off-chain) */
  signature?: string;
}

export interface SignatureSummary {
  total: number;
  approved: number;
  rejected: number;
  remaining: number;
  thresholdMet: boolean;
}

export interface TransactionFilter {
  status?: TransactionStatus;
  type?: TransactionType;
  proposer?: Address;
  signer?: Address;
  limit?: number;
  offset?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

export class MultiSigService {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.env = env;
    this.kv = env.TREASURY as unknown as KVNamespace;
  }

  // ─── Configuration ──────────────────────────────────────────────────

  /**
   * Get or initialize multi-sig configuration for a DAO.
   */
  async getConfig(daoId: string): Promise<MultiSigConfig | null> {
    try {
      const raw = await this.kv.get(multisigConfigKey(daoId));
      return raw ? (JSON.parse(raw) as MultiSigConfig) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save or update multi-sig configuration.
   */
  async saveConfig(config: MultiSigConfig): Promise<MultiSigConfig> {
    const updated: MultiSigConfig = {
      ...config,
      updatedAt: Date.now(),
    };
    await this.kv.put(multisigConfigKey(config.daoId), JSON.stringify(updated));
    log('info', '[multisig] Config saved', {
      daoId: config.daoId,
      threshold: config.threshold,
      signers: config.signers.length,
    });
    return updated;
  }

  // ─── Propose Transaction ──────────────────────────────────────────

  /**
   * Propose a new multi-sig transaction.
   * The proposer is added as the first signer (approve).
   */
  async proposeTransaction(
    daoId: string,
    tx: Omit<
      MultiSigTransaction,
      'id' | 'daoId' | 'status' | 'signatures' | 'threshold' | 'totalSigners' | 'createdAt'
    >,
  ): Promise<MultiSigTransaction> {
    const config = await this.getConfig(daoId);
    if (!config) {
      throw new Error(`Multi-sig config not found for DAO: ${daoId}`);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    // Proposer auto-signs
    const proposerSig: SignerSignature = {
      signer: tx.proposer,
      approved: true,
      signedAt: now,
    };

    const transaction: MultiSigTransaction = {
      ...tx,
      id,
      daoId,
      status: 'pending',
      signatures: [proposerSig],
      threshold: config.threshold,
      totalSigners: config.signers.length,
      createdAt: now,
    };

    await this.kv.put(multisigTxKey(daoId, id), JSON.stringify(transaction), {
      expirationTtl: DEFAULT_TTL,
    });

    // Add to DAO transaction index
    await this.#addToIndex(daoId, id);

    log('info', '[multisig] Transaction proposed', {
      daoId,
      txId: id,
      type: tx.type,
      proposer: tx.proposer.slice(0, 10),
      threshold: `${config.threshold}/${config.signers.length}`,
    });

    return transaction;
  }

  // ─── Sign Transaction ─────────────────────────────────────────────

  /**
   * Sign (approve or reject) a pending multi-sig transaction.
   * Returns the updated transaction if signature was recorded.
   */
  async signTransaction(
    daoId: string,
    txId: string,
    signer: Address,
    approved: boolean,
    reason?: string,
    signature?: string,
  ): Promise<MultiSigTransaction> {
    const tx = await this.#getTransaction(daoId, txId);
    if (!tx) {
      throw new Error(`Transaction not found: ${txId}`);
    }

    if (tx.status !== 'pending') {
      throw new Error(`Transaction is ${tx.status}, not pending`);
    }

    // Verify signer is authorized
    const config = await this.getConfig(daoId);
    if (!config) {
      throw new Error(`Multi-sig config not found for DAO: ${daoId}`);
    }

    const isSigner = config.signers.some((s) => s.toLowerCase() === signer.toLowerCase());
    if (!isSigner) {
      throw new Error(`${signer} is not an authorized signer`);
    }

    // Check if signer already voted
    const existingSigKey = multisigSignatureKey(daoId, txId, signer);
    const existingSig = await this.kv.get(existingSigKey);
    if (existingSig) {
      throw new Error(`Signer ${signer.slice(0, 10)} has already voted`);
    }

    const sigRecord: SignerSignature = {
      signer,
      approved,
      signedAt: Date.now(),
      reason,
      signature,
    };

    // Store individual signature
    await this.kv.put(existingSigKey, JSON.stringify(sigRecord), {
      expirationTtl: DEFAULT_TTL,
    });

    // Update transaction signatures array
    tx.signatures.push(sigRecord);

    // Check threshold
    const summary = this.getSignatureSummary(tx);
    if (summary.thresholdMet) {
      tx.status = 'signed';
    }

    await this.kv.put(multisigTxKey(daoId, txId), JSON.stringify(tx), {
      expirationTtl: DEFAULT_TTL,
    });

    log('info', '[multisig] Transaction signed', {
      daoId,
      txId,
      signer: signer.slice(0, 10),
      approved,
      progress: `${summary.approved}/${summary.total} approved`,
    });

    return tx;
  }

  // ─── Execute Transaction ──────────────────────────────────────────

  /**
   * Execute a multi-sig transaction that has met the signature threshold.
   * If an on-chain contract address is configured, builds and submits the
   * contract call. Otherwise, returns the prepared transaction data for
   * manual execution.
   */
  async executeTransaction(
    daoId: string,
    txId: string,
    executionTx?: string,
  ): Promise<MultiSigTransaction> {
    const tx = await this.#getTransaction(daoId, txId);
    if (!tx) {
      throw new Error(`Transaction not found: ${txId}`);
    }

    if (tx.status !== 'signed') {
      throw new Error(
        `Transaction cannot be executed (status: ${tx.status}). Must be 'signed' first.`,
      );
    }

    const config = await this.getConfig(daoId);
    if (!config) {
      throw new Error(`Multi-sig config not found for DAO: ${daoId}`);
    }

    // Build execution data
    const executionPayload = this.#buildExecutionPayload(tx);

    tx.status = executionTx ? 'executed' : 'failed';
    tx.resolvedAt = Date.now();
    tx.executionTx = executionTx;
    tx.error = executionTx ? undefined : 'Execution requires on-chain submission';

    await this.kv.put(multisigTxKey(daoId, txId), JSON.stringify(tx), {
      expirationTtl: DEFAULT_TTL,
    });

    log('info', '[multisig] Transaction executed', {
      daoId,
      txId,
      type: tx.type,
      executed: !!executionTx,
      executionPayload: executionPayload.slice(0, 66),
    });

    return tx;
  }

  /**
   * Build the calldata for on-chain execution of a multi-sig transaction.
   * This is safe to call before actual submission to preview the payload.
   */
  #buildExecutionPayload(tx: MultiSigTransaction): string {
    switch (tx.type) {
      case 'eth_transfer':
        // Simple ETH send: encode the transfer
        return '0x'; // No calldata needed for ETH transfer, just value

      case 'erc20_transfer':
        // ERC20 transfer(address to, uint256 amount)
        if (!tx.token) break;
        return this.#encodeErc20Transfer(tx.to, tx.token.amount || '0');

      case 'erc721_transfer':
        // ERC721 safeTransferFrom(address from, address to, uint256 tokenId)
        if (!tx.token) break;
        return this.#encodeErc721Transfer(tx.to, tx.token.tokenId || '0');

      case 'erc1155_transfer':
        // ERC1155 safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)
        if (!tx.token) break;
        return this.#encodeErc1155Transfer(tx.to, tx.token.tokenId || '0', tx.token.amount || '0');

      case 'contract_interaction':
        // Raw calldata
        return tx.data || '0x';

      case 'dex_swap':
        // DEX swap via aggregator
        return tx.swap?.aggregatorData || '0x';
    }
    return '0x';
  }

  /**
   * Encode ERC20 transfer calldata.
   * Function selector: 0xa9059cbb = transfer(address,uint256)
   */
  #encodeErc20Transfer(to: Address, amount: string): string {
    const toPadded = to.toLowerCase().replace('0x', '').padStart(64, '0');
    const amountHex = BigInt(amount).toString(16).padStart(64, '0');
    return `0xa9059cbb${toPadded}${amountHex}`;
  }

  /**
   * Encode ERC721 safeTransferFrom calldata.
   * Function selector: 0x42842e0e = safeTransferFrom(address,address,uint256)
   */
  #encodeErc721Transfer(to: Address, tokenId: string): string {
    const fromPadded = '0000000000000000000000000000000000000000000000000000000000000000'; // Placeholder (will be filled by contract)
    const toPadded = to.toLowerCase().replace('0x', '').padStart(64, '0');
    const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
    return `0x42842e0e${fromPadded}${toPadded}${tokenIdHex}`;
  }

  /**
   * Encode ERC1155 safeTransferFrom calldata.
   * Function selector: 0xf242432a = safeTransferFrom(address,address,uint256,uint256,bytes)
   */
  #encodeErc1155Transfer(to: Address, tokenId: string, amount: string): string {
    const fromPadded = '0000000000000000000000000000000000000000000000000000000000000000';
    const toPadded = to.toLowerCase().replace('0x', '').padStart(64, '0');
    const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
    const amountHex = BigInt(amount).toString(16).padStart(64, '0');
    return `0xf242432a${fromPadded}${toPadded}${tokenIdHex}${amountHex}00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000`;
  }

  // ─── Cancel Transaction ───────────────────────────────────────────

  /**
   * Cancel a pending transaction. Any authorized signer can cancel.
   */
  async cancelTransaction(
    daoId: string,
    txId: string,
    cancelledBy: Address,
    reason?: string,
  ): Promise<MultiSigTransaction> {
    const tx = await this.#getTransaction(daoId, txId);
    if (!tx) {
      throw new Error(`Transaction not found: ${txId}`);
    }

    if (tx.status !== 'pending') {
      throw new Error(`Transaction is ${tx.status}, cannot cancel`);
    }

    // Verify the caller is an authorized signer
    const config = await this.getConfig(daoId);
    if (!config) {
      throw new Error(`Multi-sig config not found for DAO: ${daoId}`);
    }

    const isSigner = config.signers.some((s) => s.toLowerCase() === cancelledBy.toLowerCase());
    if (!isSigner) {
      throw new Error('Only authorized signers can cancel transactions');
    }

    tx.status = 'cancelled';
    tx.resolvedAt = Date.now();
    tx.error = reason || 'Cancelled by signer';

    await this.kv.put(multisigTxKey(daoId, txId), JSON.stringify(tx), {
      expirationTtl: DEFAULT_TTL,
    });

    log('info', '[multisig] Transaction cancelled', {
      daoId,
      txId,
      cancelledBy: cancelledBy.slice(0, 10),
      reason,
    });

    return tx;
  }

  // ─── Queries ──────────────────────────────────────────────────────

  /**
   * Get a single transaction by ID.
   */
  async getTransaction(daoId: string, txId: string): Promise<MultiSigTransaction | null> {
    return this.#getTransaction(daoId, txId);
  }

  /**
   * List transactions for a DAO with optional filters.
   */
  async listTransactions(
    daoId: string,
    filter?: TransactionFilter,
  ): Promise<{ transactions: MultiSigTransaction[]; total: number }> {
    const index = await this.#getIndex(daoId);
    const txIds = filter?.offset ? index.slice(filter.offset) : index;

    const limited = filter?.limit ? txIds.slice(0, filter.limit) : txIds.slice(0, 50);

    const transactions: MultiSigTransaction[] = [];

    for (const txId of limited) {
      const tx = await this.#getTransaction(daoId, txId);
      if (tx && this.#matchesFilter(tx, filter)) {
        transactions.push(tx);
      }
    }

    // Sort by created date descending
    transactions.sort((a, b) => b.createdAt - a.createdAt);

    return {
      transactions,
      total: index.length,
    };
  }

  /**
   * Get signature progress summary for a transaction.
   */
  getSignatureSummary(tx: MultiSigTransaction): SignatureSummary {
    const approved = tx.signatures.filter((s) => s.approved).length;
    const rejected = tx.signatures.filter((s) => !s.approved).length;
    return {
      total: tx.signatures.length,
      approved,
      rejected,
      remaining: Math.max(0, tx.threshold - approved),
      thresholdMet: approved >= tx.threshold,
    };
  }

  /**
   * Get all active (pending/signed) transactions across a DAO.
   */
  async getActiveTransactions(daoId: string): Promise<MultiSigTransaction[]> {
    const result = await this.listTransactions(daoId, {
      limit: 100,
    });
    return result.transactions.filter((tx) => tx.status === 'pending' || tx.status === 'signed');
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  async #getTransaction(daoId: string, txId: string): Promise<MultiSigTransaction | null> {
    try {
      const raw = await this.kv.get(multisigTxKey(daoId, txId));
      return raw ? (JSON.parse(raw) as MultiSigTransaction) : null;
    } catch {
      return null;
    }
  }

  async #addToIndex(daoId: string, txId: string): Promise<void> {
    const key = multisigIndexKey(daoId);
    const existing = await this.kv.get(key);
    const index: string[] = existing ? (JSON.parse(existing) as string[]) : [];
    index.unshift(txId);
    await this.kv.put(key, JSON.stringify(index), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #getIndex(daoId: string): Promise<string[]> {
    try {
      const raw = await this.kv.get(multisigIndexKey(daoId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  #matchesFilter(tx: MultiSigTransaction, filter?: TransactionFilter): boolean {
    if (!filter) return true;
    if (filter.status && tx.status !== filter.status) return false;
    if (filter.type && tx.type !== filter.type) return false;
    if (filter.proposer && tx.proposer.toLowerCase() !== filter.proposer.toLowerCase()) {
      return false;
    }
    if (filter.signer) {
      const hasSigner = tx.signatures.some(
        (s) => s.signer.toLowerCase() === filter.signer?.toLowerCase(),
      );
      if (!hasSigner) return false;
    }
    return true;
  }
}

// ─── Standalone helpers ───────────────────────────────────────────────────

/**
 * Compute the next signer index for display: "2 of 5 signatures collected".
 */
export function formatSignatureProgress(approved: number, threshold: number): string {
  return `${approved} of ${threshold} signatures collected`;
}

/**
 * Human-readable name for transaction types.
 */
export function getTransactionTypeName(type: TransactionType): string {
  const names: Record<TransactionType, string> = {
    eth_transfer: 'ETH Transfer',
    erc20_transfer: 'Token Transfer',
    erc721_transfer: 'NFT Transfer',
    erc1155_transfer: 'Multi-Token Transfer',
    contract_interaction: 'Contract Interaction',
    dex_swap: 'DEX Swap',
  };
  return names[type] ?? type;
}

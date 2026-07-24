/**
 * DegenFeed DAO Framework — Treasury Tracker
 *
 * Tracks treasury balances and transaction history for DAOs.
 * Supports both Base (EVM) and Solana chains.
 */

import type { Address } from 'viem';
import type { DAOState } from './types';

export class TreasuryTracker {
  private baseRpcUrl: string;

  constructor(baseRpcUrl?: string) {
    this.baseRpcUrl = baseRpcUrl || 'https://mainnet.base.org';
  }

  /**
   * Get the treasury balance for a DAO.
   * Returns balance in native currency and USD equivalent.
   */
  async getBalance(dao: DAOState): Promise<{ balance: string; usd: number }> {
    try {
      if (dao.chain === 'base') {
        return await this.getEVMBalance(dao.treasuryAddress as Address);
      }
      return await this.getSolanaBalance(dao.treasuryAddress);
    } catch (error) {
      console.error('Failed to fetch treasury balance:', error);
      return { balance: '0', usd: 0 };
    }
  }

  /**
   * Get treasury transaction history.
   */
  async getTransactions(dao: DAOState, limit: number = 20): Promise<TreasuryTransaction[]> {
    try {
      if (dao.chain === 'base') {
        return await this.getEVMTransactions(dao.treasuryAddress as Address, limit);
      }
      return await this.getSolanaTransactions(dao.treasuryAddress, limit);
    } catch (error) {
      console.error('Failed to fetch treasury transactions:', error);
      return [];
    }
  }

  /**
   * Get ETH balance from Base.
   */
  private async getEVMBalance(address: Address): Promise<{ balance: string; usd: number }> {
    // Use public RPC to query balance
    const response = await fetch(this.baseRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch balance');

    const data = await response.json();
    const balanceWei = data.result || '0x0';
    const balanceEth = BigInt(balanceWei);

    // Format to ETH (18 decimals)
    const ethValue = Number(balanceEth) / 1e18;

    // Get USD price (approximate via CoinGecko free API)
    let usdValue = 0;
    try {
      const priceResp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      );
      const priceData = await priceResp.json();
      usdValue = ethValue * (priceData?.ethereum?.usd || 0);
    } catch {
      // Fail silently — usd is best-effort
    }

    return {
      balance: balanceEth.toString(),
      usd: usdValue,
    };
  }

  /**
   * Get SOL balance from Solana.
   */
  private async getSolanaBalance(address: string): Promise<{ balance: string; usd: number }> {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch SOL balance');

    const data = await response.json();

    if (data.error) {
      return { balance: '0', usd: 0 };
    }

    const balanceLamports = BigInt(data.result?.value || 0);
    const solValue = Number(balanceLamports) / 1e9;

    // Get USD price
    let usdValue = 0;
    try {
      const priceResp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      );
      const priceData = await priceResp.json();
      usdValue = solValue * (priceData?.solana?.usd || 0);
    } catch {
      // Fail silently
    }

    return {
      balance: balanceLamports.toString(),
      usd: usdValue,
    };
  }

  /**
   * Get EVM transaction history for the treasury address.
   */
  private async getEVMTransactions(
    address: Address,
    limit: number,
  ): Promise<TreasuryTransaction[]> {
    // Use Basescan free API for recent transactions
    try {
      const apiKey = process.env.BASESCAN_API_KEY || '';
      const response = await fetch(
        `https://api.basescan.org/api?module=account&action=txlist&address=${address}&sort=desc&offset=${limit}&apikey=${apiKey}`,
      );

      if (!response.ok) return [];

      const data = await response.json();
      if (data.status !== '1' || !data.result) return [];

      return data.result.slice(0, limit).map((tx: any) => ({
        hash: tx.hash,
        type: tx.from.toLowerCase() === address.toLowerCase() ? 'send' : 'receive',
        amount: tx.value,
        from: tx.from,
        to: tx.to,
        timestamp: Number(tx.timeStamp) * 1000,
        explorerUrl: `https://basescan.org/tx/${tx.hash}`,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get Solana transaction history for the treasury address.
   */
  private async getSolanaTransactions(
    address: string,
    limit: number,
  ): Promise<TreasuryTransaction[]> {
    try {
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit }],
        }),
      });

      if (!response.ok) return [];
      const data = await response.json();
      if (data.error) return [];

      return (data.result || []).map((sig: any) => ({
        hash: sig.signature,
        type: 'unknown',
        amount: '0',
        from: address,
        to: '',
        timestamp: sig.blockTime * 1000,
        explorerUrl: `https://solscan.io/tx/${sig.signature}`,
      }));
    } catch {
      return [];
    }
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TreasuryTransaction {
  hash: string;
  type: 'send' | 'receive' | 'unknown';
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  explorerUrl: string;
}

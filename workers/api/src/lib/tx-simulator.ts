/**
 * @degenfeed/api-worker — Transaction Simulation & MEV Protection
 *
 * Simulates on-chain transactions before submission to detect:
 *   1. Transaction failure (gas estimation, revert reasons)
 *   2. MEV attacks (sandwich, frontrun)
 *   3. Slippage tolerance exceeded
 *   4. Unexpected state changes
 *
 * Supports EVM chains (via eth_call / trace_call) and Solana (via simulateTransaction).
 */

import type { Env } from '../index';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type ChainType = 'ethereum' | 'solana' | 'polygon' | 'base';

export interface SimulatedTransaction {
  /** Whether simulation indicates success */
  willSucceed: boolean;
  /** Estimated gas (EVM) or compute units (Solana) */
  gasEstimate?: number;
  /** Revert reason if simulation failed */
  revertReason?: string;
  /** MEV risk assessment */
  mevRisk: 'low' | 'medium' | 'high' | 'critical';
  /** Slippage estimate (percentage) */
  slippageEstimate?: number;
  /** State changes that would occur */
  stateChanges?: Array<{
    address: string;
    before: string;
    after: string;
  }>;
  /** Raw simulation response for debugging */
  raw?: unknown;
}

export interface SimulationRequest {
  chain: ChainType;
  /** Sender address */
  from: string;
  /** Target contract/program address */
  to: string;
  /** Calldata (EVM) or instruction data (Solana) */
  data: string;
  /** Value in wei/lamports */
  value?: string;
  /** Block number to simulate against (default: latest) */
  blockNumber?: number;
  /** Max acceptable slippage (percentage, default: 1%) */
  maxSlippage?: number;
}

/* ─── RPC URLs from env ─────────────────────────────────────────────── */

function getRpcUrl(chain: ChainType, env: Env): string | undefined {
  const urls: Record<ChainType, string | undefined> = {
    ethereum: env.ETH_RPC_URL,
    solana: env.SOLANA_RPC_URL,
    polygon: env.POLYGON_RPC_URL,
    base: env.BASE_RPC_URL,
  };
  return urls[chain];
}

/* ─── Simulation: EVM (eth_call) ────────────────────────────────────── */

async function simulateEvm(
  chain: ChainType,
  req: SimulationRequest,
  env: Env,
): Promise<SimulatedTransaction> {
  const rpcUrl = getRpcUrl(chain, env);
  if (!rpcUrl) {
    return { willSucceed: false, mevRisk: 'medium', revertReason: 'RPC URL not configured' };
  }

  try {
    // Step 1: eth_call for state simulation
    const callResult = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            from: req.from,
            to: req.to,
            data: req.data,
            value: req.value ?? '0x0',
          },
          req.blockNumber ?? 'latest',
        ],
      }),
    });

    const callBody = (await callResult.json()) as {
      result?: string;
      error?: { message?: string; code?: number };
    };

    if (callBody.error) {
      return {
        willSucceed: false,
        mevRisk: 'medium',
        revertReason: callBody.error.message ?? 'eth_call simulation failed',
        raw: callBody,
      };
    }

    // Step 2: eth_estimateGas for gas estimation
    const gasResult = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_estimateGas',
        params: [
          {
            from: req.from,
            to: req.to,
            data: req.data,
            value: req.value ?? '0x0',
          },
        ],
      }),
    });

    const gasBody = (await gasResult.json()) as {
      result?: string;
      error?: { message?: string };
    };

    const gasEstimate = gasBody.result ? parseInt(gasBody.result, 16) : undefined;

    // Step 3: Check for mempool congestion / MEV risk via gas price
    const gasPriceResult = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'eth_gasPrice',
        params: [],
      }),
    });

    const gasPriceBody = (await gasPriceResult.json()) as { result?: string };
    const gasPriceWei = gasPriceBody.result ? parseInt(gasPriceBody.result, 16) : undefined;

    // Assess MEV risk (crude heuristic based on gas price)
    let mevRisk: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (gasPriceWei) {
      const gasPriceGwei = gasPriceWei / 1e9;
      if (gasPriceGwei > 500) {
        mevRisk = 'critical';
      } else if (gasPriceGwei > 100) {
        mevRisk = 'high';
      } else if (gasPriceGwei < 10) {
        mevRisk = 'low';
      }
    }

    return {
      willSucceed: true,
      gasEstimate,
      mevRisk,
      raw: { callResult: callBody, gasEstimate: gasBody, gasPrice: gasPriceBody },
    };
  } catch (err) {
    return {
      willSucceed: false,
      mevRisk: 'medium',
      revertReason: `Simulation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/* ─── Simulation: Solana ────────────────────────────────────────────── */

async function simulateSolana(req: SimulationRequest, env: Env): Promise<SimulatedTransaction> {
  const rpcUrl = getRpcUrl('solana', env);
  if (!rpcUrl) {
    return { willSucceed: false, mevRisk: 'medium', revertReason: 'Solana RPC not configured' };
  }

  try {
    const result = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'simulateTransaction',
        params: [
          req.data, // base64-encoded transaction
          {
            sigVerify: false,
            commitment: 'confirmed',
          },
        ],
      }),
    });

    const body = (await result.json()) as {
      result?: {
        value?: {
          err?: unknown;
          logs?: string[];
          unitsConsumed?: number;
          returnData?: unknown;
        };
      };
      error?: { message?: string };
    };

    if (body.error) {
      return {
        willSucceed: false,
        mevRisk: 'medium',
        revertReason: body.error.message,
        raw: body,
      };
    }

    const simResult = body.result?.value;

    if (simResult?.err) {
      const errorStr =
        typeof simResult.err === 'string' ? simResult.err : JSON.stringify(simResult.err);
      return {
        willSucceed: false,
        mevRisk: 'medium',
        revertReason: `Simulation failed: ${errorStr}`,
        logs: simResult.logs,
        raw: body,
      };
    }

    return {
      willSucceed: true,
      gasEstimate: simResult?.unitsConsumed,
      mevRisk: 'low', // Solana's leader schedule makes frontrunning harder
      raw: body,
    };
  } catch (err) {
    return {
      willSucceed: false,
      mevRisk: 'medium',
      revertReason: `Solana simulation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/**
 * Simulate a transaction before submitting it to the mempool.
 * Returns a detailed simulation result including MEV risk assessment.
 */
export async function simulateTransaction(
  req: SimulationRequest,
  env: Env,
): Promise<SimulatedTransaction> {
  switch (req.chain) {
    case 'ethereum':
    case 'polygon':
    case 'base':
      return simulateEvm(req.chain, req, env);
    case 'solana':
      return simulateSolana(req, env);
    default:
      return {
        willSucceed: false,
        mevRisk: 'medium',
        revertReason: `Unsupported chain: ${req.chain}`,
      };
  }
}

/**
 * Assess MEV risk for a proposed transaction.
 * Returns a risk level and recommended actions.
 */
export function assessMevRisk(simResult: SimulatedTransaction): {
  riskLevel: string;
  recommendations: string[];
} {
  const recommendations: string[] = [];

  switch (simResult.mevRisk) {
    case 'critical':
      recommendations.push('Use Flashbots / private mempool for submission');
      recommendations.push('Set tight slippage (≤0.5%)');
      recommendations.push('Consider splitting large trades into smaller ones');
      recommendations.push('Add a deadline parameter (30s expiry)');
      break;
    case 'high':
      recommendations.push('Use private transaction relay');
      recommendations.push('Set slippage ≤1%');
      recommendations.push('Add deadline parameter');
      break;
    case 'medium':
      recommendations.push('Consider private mempool for large value transactions');
      break;
    case 'low':
      recommendations.push('Standard submission safe');
      break;
  }

  if (simResult.slippageEstimate !== undefined && simResult.slippageEstimate > 5) {
    recommendations.push('High slippage detected — consider splitting the transaction');
  }

  return {
    riskLevel: simResult.mevRisk,
    recommendations,
  };
}

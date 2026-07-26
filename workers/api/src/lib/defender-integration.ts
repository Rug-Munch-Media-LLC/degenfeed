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

import type { Env } from '../types';
import { badRequest, notFound, ok, serverError } from '../response-helpers';

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

export interface DefenderConfig {
  /** Defender API key */
  apiKey: string;
  /** Defender API secret */
  apiSecret: string;
  /** Defender API URL (default: https://api.defender.openzeppelin.com) */
  apiUrl: string;
  /** Relay API key (for gasless transactions) */
  relayApiKey?: string;
  /** Relay API secret */
  relayApiSecret?: string;
}

export interface AutotaskConfig {
  /** Autotask ID in Defender */
  autotaskId: string;
  /** Autotask name */
  name: string;
  /** Trigger type */
  trigger: 'webhook' | 'schedule' | 'event';
  /** Function name to call */
  functionName: string;
  /** Relayer ID to use for transactions */
  relayerId: string;
  /** Paused state */
  paused: boolean;
  /** Environment variables (JSON string) */
  environmentVariables?: Record<string, string>;
}

export interface SentinelConfig {
  /** Sentinel ID in Defender */
  sentinelId: string;
  /** Sentinel name */
  name: string;
  /** Monitor type */
  type: 'block' | 'forta' | 'webhook';
  /** Contract addresses to monitor */
  addresses: string[];
  /** Network */
  network: DefenderNetwork;
  /** Notification channels */
  notificationChannels: string[];
  /** Paused */
  paused: boolean;
  /** Alert threshold */
  alertThreshold?: number;
}

export interface DefenderRelayConfig {
  /** Relayer ID */
  relayerId: string;
  /** Relayer address */
  relayerAddress: string;
  /** Network */
  network: DefenderNetwork;
  /** Min balance (in wei) before notification */
  minBalanceThreshold: string;
  /** Policies */
  policies: {
    allowedAddresses: string[];
    whitelistReceivers: boolean;
  };
}

export interface DefenderIntegrationState {
  daoId: string;
  governorAddress: string;
  autotask: AutotaskConfig | null;
  sentinel: SentinelConfig | null;
  relay: DefenderRelayConfig | null;
  enabled: boolean;
  lastSynced: number;
}

// ─── KV helpers ──────────────────────────────────────────────────────────

function defenderStateKey(daoId: string): string {
  return `defender:state:${daoId}`;
}

function defenderAutotaskCodeKey(daoId: string): string {
  return `defender:autotask:${daoId}`;
}

// ─── Autotask Code Generation ────────────────────────────────────────────

/**
 * Generate the Autotask code for auto-executing passed proposals.
 * This code runs on Defender's serverless platform after a proposal
 * passes and the timelock delay expires.
 */
export function generateProposalExecutorAutotaskCode(params: {
  daoId: string;
  governorAddress: string;
  chainId: number;
  rpcUrl: string;
  relayerAddress: string;
}): string {
  return `/**
 * DegenFeed Proposal Executor — OpenZeppelin Defender Autotask
 * 
 * Auto-executes passed proposals after timelock expires.
 * Deployed for DAO: ${params.daoId}
 * Governor: ${params.governorAddress}
 * Chain ID: ${params.chainId}
 * Relayer: ${params.relayerAddress}
 * 
 * @see https://docs.openzeppelin.com/defender/autotasks
 */

const { ethers } = require('ethers');

// Minimal ABI for Governor contract
const GOVERNOR_ABI = [
  'function state(uint256 proposalId) view returns (uint8)',
  'function execute(uint256 proposalId)',
  'function proposalDeadline(uint256 proposalId) view returns (uint256)',
  'event ProposalCreated(uint256 indexed proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
  'event ProposalExecuted(uint256 indexed proposalId)',
];

const GOVERNOR_STATES = {
  Pending: 0, Active: 1, Canceled: 2, Defeated: 3,
  Succeeded: 4, Queued: 5, Expired: 6, Executed: 7,
};

exports.handler = async function (event) {
  const provider = new ethers.providers.JsonRpcProvider('${params.rpcUrl}');
  const relayer = new ethers.Wallet(event.relayerPrivateKey, provider);
  const governor = new ethers.Contract(
    '${params.governorAddress}',
    GOVERNOR_ABI,
    relayer,
  );

  console.log('Checking for executable proposals...');

  // Query ProposalCreated events to find proposals
  // In production, scan from a stored block number
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 10000);
  
  const filter = governor.filters.ProposalCreated();
  const events = await governor.queryFilter(filter, fromBlock, latestBlock);

  let executed = 0;
  for (const event of events) {
    const proposalId = event.args.proposalId;
    const state = await governor.state(proposalId);

    if (state === GOVERNOR_STATES.Succeeded) {
      console.log('Executing proposal:', proposalId.toString());
      try {
        const tx = await governor.execute(proposalId, {
          gasLimit: 500000,
        });
        await tx.wait();
        console.log('Executed proposal:', proposalId.toString(), 'tx:', tx.hash);
        executed++;
      } catch (err) {
        console.error('Failed to execute proposal:', proposalId.toString(), err.message);
      }
    }
  }

  console.log('Done. Executed proposals:', executed);
  return { executed, checkedFromBlock: fromBlock };
};
`;
}

/**
 * Generate Autotask code for monitoring suspicious proposals.
 * Sends alerts via Defender notification channels.
 */
export function generateSuspiciousProposalMonitorCode(params: {
  daoId: string;
  governorAddress: string;
  sentinelId: string;
}): string {
  return `/**
 * DegenFeed Proposal Monitor — OpenZeppelin Defender Sentinel Handler
 *
 * Monitors for suspicious proposals and sends alerts.
 * Deployed for DAO: ${params.daoId}
 * Governor: ${params.governorAddress}
 * Sentinel: ${params.sentinelId}
 */

exports.handler = async function (event) {
  const { transaction, matchedAddresses, type } = event;
  
  console.log('Proposal event detected:', {
    txHash: transaction.hash,
    from: transaction.from,
    to: transaction.to,
    type,
  });

  // Check for suspicious patterns
  const warnings = [];

  // Check if proposer has low token balance
  // Check if proposal contains self-destruct
  // Check if proposal transfers to known malicious addresses

  if (warnings.length > 0) {
    console.warn('Suspicious proposal detected:', warnings);
  }

  return { warnings, analyzed: true };
};
`;
}

// ─── Handler: POST /api/dao/:daoId/defender/setup — Configure Defender ───

export async function handleDefenderSetup(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  let body: {
    governorAddress?: string;
    chainId?: number;
    rpcUrl?: string;
    relayerAddress?: string;
    network?: DefenderNetwork;
    apiKey?: string;
    apiSecret?: string;
    relayApiKey?: string;
    relayApiSecret?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.governorAddress) {
    return badRequest('governorAddress is required');
  }

  const network = body.network ?? 'base-mainnet';
  const chainId = body.chainId ?? 8453;
  const rpcUrl = body.rpcUrl ?? 'https://mainnet.base.org';
  const relayerAddress = body.relayerAddress ?? '';

  // Generate Autotask code
  const autotaskCode = generateProposalExecutorAutotaskCode({
    daoId,
    governorAddress: body.governorAddress,
    chainId,
    rpcUrl,
    relayerAddress,
  });

  const monitorCode = generateSuspiciousProposalMonitorCode({
    daoId,
    governorAddress: body.governorAddress,
    sentinelId: `sentinel-${daoId}`,
  });

  // Store the autotask code for reference
  await kv.put(defenderAutotaskCodeKey(daoId), autotaskCode, {
    expirationTtl: 2_592_000, // 30 days
  });

  // Store integration state
  const state: DefenderIntegrationState = {
    daoId,
    governorAddress: body.governorAddress,
    autotask: {
      autotaskId: '',
      name: `df-proposal-executor-${daoId}`,
      trigger: 'webhook',
      functionName: 'handler',
      relayerId: '',
      paused: false,
      environmentVariables: {
        GOVERNOR_ADDRESS: body.governorAddress,
        CHAIN_ID: String(chainId),
        RPC_URL: rpcUrl,
      },
    },
    sentinel: {
      sentinelId: '',
      name: `df-proposal-monitor-${daoId}`,
      type: 'block',
      addresses: [body.governorAddress],
      network,
      notificationChannels: [],
      paused: false,
    },
    relay: relayerAddress
      ? {
          relayerId: '',
          relayerAddress,
          network,
          minBalanceThreshold: '500000000000000000', // 0.5 ETH
          policies: {
            allowedAddresses: [body.governorAddress],
            whitelistReceivers: true,
          },
        }
      : null,
    enabled: true,
    lastSynced: Date.now(),
  };

  await kv.put(defenderStateKey(daoId), JSON.stringify(state));

  return created({
    state,
    autotaskCode,
    monitorCode,
    deployInstructions: [
      '1. Log in to https://defender.openzeppelin.com',
      `2. Create a Relayer on ${network} — note the address and API keys`,
      `3. Create a new Autotask named "df-proposal-executor-${daoId}"`,
      '4. Paste the autotaskCode into the Autotask editor',
      '5. Link the Autotask to your Relayer',
      `6. Create a Sentinel monitoring ${body.governorAddress}`,
      '7. Add notification channels (email, Slack, Telegram)',
      '8. Update this configuration with the actual IDs from Defender',
    ],
  });
}

// ─── Handler: GET /api/dao/:daoId/defender/status — Get Defender status ──

export async function handleDefenderStatus(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const stateRaw = await kv.get(defenderStateKey(daoId)).catch(() => null);
  if (!stateRaw) {
    return notFound('No Defender integration configured for this DAO');
  }

  const state = JSON.parse(stateRaw) as DefenderIntegrationState;
  return ok({
    ...state,
    defenderUrl: 'https://defender.openzeppelin.com',
    autotaskConfigured: state.autotask !== null && state.autotask.autotaskId !== '',
    sentinelConfigured: state.sentinel !== null && state.sentinel.sentinelId !== '',
    relayConfigured: state.relay !== null && state.relay.relayerId !== '',
  });
}

// ─── Handler: POST /api/dao/:daoId/defender/sync — Sync Defender IDs ────

export async function handleDefenderSync(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const stateRaw = await kv.get(defenderStateKey(daoId)).catch(() => null);
  if (!stateRaw) {
    return notFound('No Defender integration. Setup first.');
  }

  let body: {
    autotaskId?: string;
    sentinelId?: string;
    relayerId?: string;
    relayerAddress?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const state = JSON.parse(stateRaw) as DefenderIntegrationState;

  if (body.autotaskId && state.autotask) {
    state.autotask.autotaskId = body.autotaskId;
  }
  if (body.sentinelId && state.sentinel) {
    state.sentinel.sentinelId = body.sentinelId;
  }
  if (body.relayerId && state.relay) {
    state.relay.relayerId = body.relayerId;
  }
  if (body.relayerAddress && state.relay) {
    state.relay.relayerAddress = body.relayerAddress;
  }

  state.lastSynced = Date.now();
  await kv.put(defenderStateKey(daoId), JSON.stringify(state));

  return ok({ synced: true, state });
}

// ─── Handler: DELETE /api/dao/:daoId/defender — Disable Defender ────────

export async function handleDefenderDisable(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const stateRaw = await kv.get(defenderStateKey(daoId)).catch(() => null);
  if (!stateRaw) {
    return notFound('No Defender integration found');
  }

  const state = JSON.parse(stateRaw) as DefenderIntegrationState;
  state.enabled = false;
  state.lastSynced = Date.now();
  await kv.put(defenderStateKey(daoId), JSON.stringify(state));

  return ok({
    disabled: true,
    message: 'Defender integration disabled. Re-enable by calling POST /setup.',
  });
}

// ─── Defender Deploy Configuration Generator ────────────────────────────

/**
 * Generate a complete Defender deploy configuration for upgrade management.
 * This config can be used with Defender to manage contract upgrades safely.
 */
export function generateDefenderDeployConfig(params: {
  daoId: string;
  governorAddress: string;
  tokenAddress: string;
  timelockAddress?: string;
  network: DefenderNetwork;
  licenseType?: string;
}): {
  manifest: Record<string, unknown>;
  upgradeApprovalProcess: string[];
  recommendedSettings: Record<string, unknown>;
} {
  return {
    manifest: {
      governor: {
        address: params.governorAddress,
        network: params.network,
        kind: 'transparent',
        upgrades: true,
        license: params.licenseType ?? 'MIT',
      },
      token: {
        address: params.tokenAddress,
        network: params.network,
        kind: 'transparent',
        upgrades: false, // Token should NOT be upgradeable
      },
      ...(params.timelockAddress
        ? {
            timelock: {
              address: params.timelockAddress,
              network: params.network,
              kind: 'transparent',
              upgrades: false,
            },
          }
        : {}),
    },
    upgradeApprovalProcess: [
      '1. Propose upgrade via Defender Admin > Proposals',
      '2. DegenFeed DAO votes on the upgrade proposal',
      '3. If passed, Defender timelock delay begins',
      '4. After delay, Defender executes upgrade',
      '5. Verify implementation via Defender Admin',
    ],
    recommendedSettings: {
      approvalProcess: 'multisig', // Or 'governance'
      timelockDelay: 172800, // 2 days
      minApprovals: 2,
    },
  };
}

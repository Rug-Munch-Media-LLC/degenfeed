/**
 * @degenfeed/solana-programs — Realms / SPL Governance Compatibility
 *
 * Ensures DegenFeed Solana DAOs are compatible with Realms (the Solana
 * DAO management UI) and SPL Governance standards.
 *
 * Capabilities:
 *   1. SPL Governance compatibility verification
 *   2. Token compatibility wrapper for DegenFeed SPL tokens
 *   3. Proposal bridge between DegenFeed and Realms
 *   4. Realm registration/pairing
 *   5. Governance program ID resolution
 *
 * @see https://realms.today/
 * @see https://spl.solana.com/governance
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface SPLGovernanceConfig {
  /** SPL Governance program ID (mainnet-beta) */
  governanceProgramId: string;
  /** Realm ID (public key) */
  realmId: string;
  /** Realm authority (pubkey) */
  realmAuthority: string;
  /** Community mint (voting token) */
  communityMint: string;
  /** Council mint (optional, for multi-token governance) */
  councilMint?: string;
  /** Minimum tokens to create a proposal */
  minCommunityTokensToCreateProposal: number;
  /** Minimum instruction hold up time in seconds */
  minInstructionHoldUpTime: number;
  /** Max voting time in seconds */
  maxVotingTime: number;
  /** Vote threshold percentage (e.g. 60 for 60%) */
  voteThresholdPercentage: number;
}

export interface RealmPairing {
  /** DegenFeed DAO ID */
  daoId: string;
  /** Realms realm ID (Solana pubkey) */
  realmId: string;
  /** Governance program ID used */
  governanceProgramId: string;
  /** Community token mint address */
  communityMint: string;
  /** Council mint address (if any) */
  councilMint?: string;
  /** Whether the realm is active on-chain */
  active: boolean;
  /** Realms.today URL */
  realmsUrl: string;
  /** Linked at timestamp */
  linkedAt: number;
  /** Total proposals bridged */
  proposalsBridged: number;
}

export interface RealmsProposal {
  /** Realms proposal public key */
  proposalPk: string;
  /** Realm public key */
  realmPk: string;
  /** Governance public key */
  governancePk: string;
  /** Proposal name */
  name: string;
  /** Description link (usually Arweave/IPFS) */
  descriptionLink: string;
  /** Vote type (e.g. 'YesNoVote') */
  voteType: string;
  /** Proposal options */
  options: string[];
  /** Denial option */
  denyOption: string;
  /** Vote threshold */
  voteThreshold: number;
  /** State (Draft, Voting, Succeeded, etc.) */
  state: string;
  /** Max voting time in seconds */
  maxVotingTime: number;
  /** Start slot */
  startSlot: number;
  /** End slot */
  endSlot: number;
  /** Timestamp created */
  createdAt: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

/**
 * Known SPL Governance program IDs on Solana mainnet-beta.
 */
export const SPL_GOVERNANCE_PROGRAM_IDS: Record<string, string> = {
  'mainnet-beta': 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
  devnet: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
  testnet: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
};

/** Realms web base URL */
export const REALMS_BASE_URL = 'https://realms.today';

/** Minimum SPL Governance params for a DegenFeed DAO */
export const DEFAULT_SPL_GOVERNANCE_PARAMS: Omit<
  SPLGovernanceConfig,
  'realmId' | 'realmAuthority' | 'communityMint'
> = {
  governanceProgramId: SPL_GOVERNANCE_PROGRAM_IDS['mainnet-beta']!,
  minCommunityTokensToCreateProposal: 100,
  minInstructionHoldUpTime: 0,
  maxVotingTime: 259200, // 3 days in seconds
  voteThresholdPercentage: 60,
};

// ─── SPL Governance Compatibility Check ──────────────────────────────────

/**
 * Verify that a DegenFeed Solana DAO configuration is compatible
 * with SPL Governance and Realms.
 */
export function checkSPLGovernanceCompatibility(config: {
  tokenMint: string;
  tokenDecimals: number;
  tokenSupply: number;
  hasCouncilMint: boolean;
  governanceProgramId?: string;
}): {
  compatible: boolean;
  checks: Array<{ check: string; passed: boolean; detail: string }>;
  recommendations: string[];
} {
  const checks: Array<{ check: string; passed: boolean; detail: string }> = [];
  const recommendations: string[] = [];

  // Token mint must be a valid Solana pubkey (base58, 32 bytes)
  checks.push({
    check: 'Token mint is a valid base58 public key',
    passed: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(config.tokenMint),
    detail: `Token mint: ${config.tokenMint}`,
  });
  if (!checks[0]?.passed) {
    recommendations.push('Use a valid SPL token mint address as the community mint');
  }

  // Token decimals must be reasonable
  checks.push({
    check: 'Token decimals are within SPL Governance range (0-9 recommended)',
    passed: config.tokenDecimals >= 0 && config.tokenDecimals <= 9,
    detail: `Decimals: ${config.tokenDecimals}`,
  });
  if (!checks[1]?.passed) {
    recommendations.push('SPL Governance works best with 0-9 decimal tokens');
  }

  // Token supply should be reasonable
  checks.push({
    check: 'Token supply is sufficient for governance participation',
    passed: config.tokenSupply >= 1000,
    detail: `Supply: ${config.tokenSupply}`,
  });
  if (!checks[2]?.passed) {
    recommendations.push('Consider a larger token supply for governance');
  }

  // Governance program ID check
  const isKnownProgram = Object.values(SPL_GOVERNANCE_PROGRAM_IDS).includes(
    config.governanceProgramId ?? SPL_GOVERNANCE_PROGRAM_IDS['mainnet-beta']!,
  );
  checks.push({
    check: 'Governance program ID is the official SPL Governance program',
    passed: isKnownProgram,
    detail: `Program ID: ${config.governanceProgramId ?? SPL_GOVERNANCE_PROGRAM_IDS['mainnet-beta']}`,
  });
  if (!checks[3]?.passed) {
    recommendations.push('Use the official SPL Governance program ID');
  }

  const compatible = checks.every((c) => c.passed);

  return {
    compatible,
    checks,
    recommendations: compatible
      ? ['Your DAO is compatible with Realms. Follow the setup instructions below.']
      : recommendations.length > 0
        ? recommendations
        : ['Address the failed checks above and re-verify.'],
  };
}

// ─── Realm Configuration Generator ───────────────────────────────────────

/**
 * Generate an SPL Governance realm configuration that can be used
 * to create or pair with a Realms realm.
 */
export function generateRealmConfig(params: {
  daoName: string;
  communityMint: string;
  councilMint?: string;
  realmAuthority?: string;
  network?: string;
}): SPLGovernanceConfig {
  const network = params.network ?? 'mainnet-beta';

  return {
    governanceProgramId:
      SPL_GOVERNANCE_PROGRAM_IDS[network] ?? SPL_GOVERNANCE_PROGRAM_IDS['mainnet-beta']!,
    realmId: '', // Populated after realm creation
    realmAuthority: params.realmAuthority ?? '',
    communityMint: params.communityMint,
    councilMint: params.councilMint,
    minCommunityTokensToCreateProposal:
      DEFAULT_SPL_GOVERNANCE_PARAMS.minCommunityTokensToCreateProposal,
    minInstructionHoldUpTime: DEFAULT_SPL_GOVERNANCE_PARAMS.minInstructionHoldUpTime,
    maxVotingTime: DEFAULT_SPL_GOVERNANCE_PARAMS.maxVotingTime,
    voteThresholdPercentage: DEFAULT_SPL_GOVERNANCE_PARAMS.voteThresholdPercentage,
  };
}

// ─── Token Compatibility Wrapper ─────────────────────────────────────────

/**
 * DegenFeed Solana tokens work with SPL Governance if they are proper
 * SPL Token mints. This wrapper provides the metadata needed.
 */
export interface DegenFeedTokenMetadata {
  /** SPL Token mint address */
  mintAddress: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** Total supply (raw, before decimals) */
  totalSupply: string;
  /** Token metadata URI (Metaplex standard) */
  uri?: string;
  /** Whether this token is transferable */
  isTransferable: boolean;
  /** Whether this token has freeze authority */
  hasFreezeAuthority: boolean;
  /** Whether this token has mint authority */
  hasMintAuthority: boolean;
}

/**
 * Wrap a DegenFeed token metadata for compatibility with SPL Governance.
 * Checks that the token meets Realms requirements.
 */
export function wrapTokenForSPLGovernance(token: DegenFeedTokenMetadata): {
  compatible: boolean;
  governanceToken: {
    mint: string;
    name: string;
    symbol: string;
    uiSupply: number;
    source: string;
  };
  issues: string[];
} {
  const issues: string[] = [];

  if (token.hasMintAuthority) {
    issues.push(
      'Token has an active mint authority — SPL Governance realms should not have inflationary tokens',
    );
  }

  if (token.hasFreezeAuthority) {
    issues.push('Token has a freeze authority — may interfere with governance token operations');
  }

  const uiSupply = Number(token.totalSupply) / 10 ** token.decimals;

  return {
    compatible: issues.length === 0,
    governanceToken: {
      mint: token.mintAddress,
      name: token.name,
      symbol: token.symbol,
      uiSupply,
      source: 'DegenFeed',
    },
    issues,
  };
}

// ─── Proposal Bridge ─────────────────────────────────────────────────────

/**
 * Bridge a DegenFeed proposal to Realms format.
 * Returns a transaction instruction set that can be submitted to
 * create the proposal on the SPL Governance program.
 */
export function bridgeProposalToRealms(params: {
  realmId: string;
  governancePk: string;
  name: string;
  description: string;
  options: string[];
  voteThreshold: number;
  maxVotingTime: number;
  proposalIndex: number;
}): {
  instructions: Array<{
    programId: string;
    name: string;
    accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
    data: string;
  }>;
  realmsUrl: string;
} {
  // This constructs the instruction set for creating a proposal on
  // the SPL Governance program. In production, these would be
  // serialized using @solana/web3.js TransactionInstruction.

  const proposalAddress = `${params.realmId.slice(0, 8)}...${params.proposalIndex}`;

  return {
    instructions: [
      {
        programId: SPL_GOVERNANCE_PROGRAM_IDS['mainnet-beta']!,
        name: 'createProposal',
        accounts: [
          { pubkey: params.realmId, isSigner: false, isWritable: false },
          { pubkey: params.governancePk, isSigner: false, isWritable: true },
          { pubkey: proposalAddress, isSigner: false, isWritable: true },
        ],
        data: `create_proposal:${params.name}:${params.voteThreshold}:${params.maxVotingTime}`,
      },
    ],
    realmsUrl: `${REALMS_BASE_URL}/dao/${params.realmId}/proposal/${proposalAddress}`,
  };
}

/**
 * Parse a Realms proposal into DegenFeed format for unified analytics.
 */
export function parseRealmsProposal(proposal: RealmsProposal): {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'cancelled';
  choices: string[];
  startTime: number;
  endTime: number;
  platform: string;
} {
  const statusMap: Record<string, 'active' | 'passed' | 'rejected' | 'cancelled'> = {
    Draft: 'active',
    Voting: 'active',
    Succeeded: 'passed',
    Executing: 'passed',
    Completed: 'passed',
    Defeated: 'rejected',
    Cancelled: 'cancelled',
    Vetoed: 'rejected',
  };

  return {
    id: proposal.proposalPk,
    title: proposal.name,
    description: `Realms proposal ${proposal.proposalPk}`,
    status: statusMap[proposal.state] ?? 'active',
    choices: proposal.options,
    startTime: proposal.startSlot,
    endTime: proposal.endSlot,
    platform: 'realms',
  };
}

// ─── Realm Pairing Helpers ───────────────────────────────────────────────

/**
 * Generate a Realms.today URL for a realm.
 */
export function getRealmsUrl(realmId: string): string {
  return `${REALMS_BASE_URL}/dao/${realmId}`;
}

/**
 * Generate the realm creation instructions for Realms.
 */
export function getRealmCreationInstructions(params: {
  communityMint: string;
  councilMint?: string;
  network?: string;
  realmAuthority?: string;
}): {
  governanceProgramId: string;
  steps: string[];
  realmsSetupUrl: string;
} {
  const programId = SPL_GOVERNANCE_PROGRAM_IDS[params.network ?? 'mainnet-beta']!;

  return {
    governanceProgramId: programId,
    steps: [
      '1. Go to https://realms.today/dao/create',
      `2. Use community mint: ${params.communityMint}`,
      params.councilMint
        ? `3. Set council mint: ${params.councilMint}`
        : '3. Skip council mint (single-token DAO)',
      `4. Governance program: ${programId}`,
      '5. Configure voting parameters (min tokens, threshold, voting period)',
      '6. Create the realm and note the realm ID',
      '7. Pair this realm with your DegenFeed DAO via the pairing endpoint',
    ],
    realmsSetupUrl: 'https://realms.today/dao/create',
  };
}

/**
 * Pair a DegenFeed DAO with a Realms realm.
 * Stores the cross-reference for unified discovery.
 */
export function createRealmPairing(params: {
  daoId: string;
  realmId: string;
  communityMint: string;
  councilMint?: string;
  network?: string;
}): RealmPairing {
  return {
    daoId: params.daoId,
    realmId: params.realmId,
    governanceProgramId: SPL_GOVERNANCE_PROGRAM_IDS[params.network ?? 'mainnet-beta']!,
    communityMint: params.communityMint,
    councilMint: params.councilMint,
    active: true,
    realmsUrl: getRealmsUrl(params.realmId),
    linkedAt: Date.now(),
    proposalsBridged: 0,
  };
}

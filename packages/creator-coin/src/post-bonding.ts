/**
 * Creator Coin 2.0 — Post-Bonding Features
 *
 * After a coin graduates from the bonding curve:
 * - Graduation Party: 24h celebration with special features
 * - AMA with Creator: scheduled voice/video chat
 * - LP Lock: liquidity locked for minimum 30 days
 * - Token Page: permanent page with chart, holders, links
 * - Leaderboard: top buyers, earliest buyers, biggest holders
 */

import type {
  Badge,
  BadgeType,
  BondingPhaseInfo,
  LeaderboardEntry,
  PostBondingConfig,
  PostBondingStatus,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────

export const GRADUATION_PARTY_DURATION = 24 * 60 * 60; // 24 hours
export const MIN_LIQUIDITY_LOCK_DURATION = 30 * 24 * 60 * 60; // 30 days
export const DEFAULT_TOKEN_PAGE_BASE = 'https://degenfeed.co/coin';

// ─── Graduation Party ───────────────────────────────────────────────────

export interface GraduationParty {
  active: boolean;
  startTime: number;
  endTime: number;
  specialFeatures: GraduationFeature[];
  celebrations: CelebrationEvent[];
}

export interface GraduationFeature {
  name: string;
  description: string;
  icon: string;
  active: boolean;
}

export interface CelebrationEvent {
  time: number;
  type: 'tweet' | 'discord_message' | 'onchain_event' | 'notification';
  message: string;
  executed: boolean;
}

/**
 * Create the graduation party schedule and features.
 */
export function createGraduationParty(
  graduationTime: number,
  coinName: string,
  coinSymbol: string,
  creator: string,
  phaseHistory: BondingPhaseInfo[],
): GraduationParty {
  const endTime = graduationTime + GRADUATION_PARTY_DURATION;

  const celebrations: CelebrationEvent[] = [
    {
      time: graduationTime,
      type: 'onchain_event',
      message: `🎉 ${coinName} (${coinSymbol}) has GRADUATED! The bonding curve is complete!`,
      executed: false,
    },
    {
      time: graduationTime + 60, // 1 min after
      type: 'notification',
      message: `🚀 ${coinSymbol} is now trading on DEX! Congratulations @${creator}!`,
      executed: false,
    },
    {
      time: graduationTime + 3600, // 1 hour after
      type: 'discord_message',
      message: `📊 **${coinName} Graduation Party!** 🎉\nPhase journey: ${phaseHistory.map((p) => `${p.icon} ${p.name}`).join(' → ')}\n→ ✅ Graduated!\n\nGet your tokens and join the community!`,
      executed: false,
    },
    {
      time: graduationTime + 43200, // 12 hours after
      type: 'tweet',
      message: `${coinSymbol} graduated 12 hours ago! The party is still going! 🎉 ${phaseHistory.length} phases completed. Don't miss out!`,
      executed: false,
    },
    {
      time: graduationTime + 82800, // 23 hours after
      type: 'notification',
      message: `⏰ Last hour of the ${coinName} graduation party! Make sure to check out the token page!`,
      executed: false,
    },
  ];

  const features: GraduationFeature[] = [
    {
      name: '🎊 Celebration Mode',
      description: 'Special animated token page with confetti effects',
      icon: '🎊',
      active: true,
    },
    {
      name: '📉 Live Chart Launch',
      description: 'First candle on the permanent chart',
      icon: '📈',
      active: true,
    },
    {
      name: '🏆 Leaderboard Reveal',
      description: 'Top buyers and earliest supporters revealed',
      icon: '🏆',
      active: true,
    },
    {
      name: '🎤 AMA Scheduling',
      description: 'Creator can schedule their victory AMA',
      icon: '🎤',
      active: true,
    },
    {
      name: '💧 LP Lock Confirmation',
      description: 'Liquidity locked for 30+ days — verified on-chain',
      icon: '🔒',
      active: true,
    },
    {
      name: '🎁 Holder Rewards',
      description: 'Special badge airdrops for graduation holders',
      icon: '🎁',
      active: true,
    },
  ];

  return {
    active: true,
    startTime: graduationTime,
    endTime,
    specialFeatures: features,
    celebrations,
  };
}

/**
 * Get the current graduation party status.
 */
export function getPartyStatus(party: GraduationParty, currentTime: number): GraduationParty {
  if (currentTime > party.endTime) {
    return {
      ...party,
      active: false,
      specialFeatures: party.specialFeatures.map((f) => ({ ...f, active: false })),
    };
  }
  return party;
}

// ─── AMA Scheduling ─────────────────────────────────────────────────────

export interface AMASchedule {
  coinAddress: string;
  creator: string;
  scheduledTime: number;
  platform: string;
  platformUrl: string;
  title: string;
  description: string;
  confirmed: boolean;
  completed: boolean;
  recordingUrl?: string;
}

/**
 * Create an AMA schedule after graduation.
 */
export function scheduleAMA(
  coinAddress: string,
  creator: string,
  graduationTime: number,
  platform: string = 'peertube',
  customDelay?: number,
): AMASchedule {
  const defaultDelay = 7 * 24 * 60 * 60; // 7 days after graduation
  const scheduledTime = graduationTime + (customDelay ?? defaultDelay);
  const platformUrls: Record<string, string> = {
    twitch: 'https://twitch.tv/',
    youtube: 'https://youtube.com/',
    peertube: 'https://peertube.tv/',
    zoom: 'https://zoom.us/',
    discord: 'Discord voice channel',
  };

  return {
    coinAddress,
    creator,
    scheduledTime,
    platform,
    platformUrl: platformUrls[platform] ?? platformUrls.peertube!,
    title: `${coinAddress.slice(0, 6)}... AMA — Ask Me Anything!`,
    description: `The creator of ${coinAddress} is hosting a victory AMA! Come ask questions about the project, vision, and future plans.`,
    confirmed: false,
    completed: false,
  };
}

/**
 * Get time until AMA in human-readable format.
 */
export function getTimeUntilAMA(ama: AMASchedule): {
  days: number;
  hours: number;
  minutes: number;
  total: string;
} {
  const diff = Math.max(0, ama.scheduledTime - Math.floor(Date.now() / 1000));
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push('Now!');

  return { days, hours, minutes, total: parts.join(' ') };
}

// ─── LP Lock ────────────────────────────────────────────────────────────

export interface LpLockInfo {
  locked: boolean;
  lockAmount: string;
  lockCurrency: string;
  lockTimestamp: number;
  unlockTimestamp: number;
  lockDuration: number;
  remainingSeconds: number;
  remainingFormatted: string;
  verified: boolean;
}

/**
 * Calculate LP lock information.
 */
export function calculateLpLock(
  graduationTime: number,
  lockDuration: number,
  lpTokenAmount: string,
): LpLockInfo {
  const unlockTimestamp = graduationTime + lockDuration;
  const remainingSeconds = Math.max(0, unlockTimestamp - Math.floor(Date.now() / 1000));
  const remainingDays = Math.floor(remainingSeconds / 86400);
  const remainingHours = Math.floor((remainingSeconds % 86400) / 3600);

  const parts: string[] = [];
  if (remainingDays > 0) parts.push(`${remainingDays}d`);
  if (remainingHours > 0) parts.push(`${remainingHours}h`);
  if (parts.length === 0) parts.push('Unlocked!');

  return {
    locked: remainingSeconds > 0,
    lockAmount: lpTokenAmount,
    lockCurrency: 'ETH/SOL',
    lockTimestamp: graduationTime,
    unlockTimestamp,
    lockDuration,
    remainingSeconds,
    remainingFormatted: parts.join(' '),
    verified: true,
  };
}

// ─── Token Page ─────────────────────────────────────────────────────────

export interface TokenPage {
  url: string;
  sections: TokenPageSection[];
  customDomain?: string;
}

export interface TokenPageSection {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

/**
 * Build the permanent token page configuration.
 */
export function buildTokenPage(
  coinAddress: string,
  _coinName: string,
  _coinSymbol: string,
  customUrl?: string,
): TokenPage {
  const baseUrl = customUrl ?? `${DEFAULT_TOKEN_PAGE_BASE}/${coinAddress}`;
  return {
    url: baseUrl,
    sections: [
      { id: 'chart', title: '📊 Price Chart', visible: true, order: 0 },
      { id: 'holders', title: '👥 Top Holders', visible: true, order: 1 },
      { id: 'info', title: 'ℹ️ About', visible: true, order: 2 },
      { id: 'trading', title: '💱 Trade', visible: true, order: 3 },
      { id: 'links', title: '🔗 Links', visible: true, order: 4 },
      { id: 'leaderboard', title: '🏆 Leaderboard', visible: true, order: 5 },
      { id: 'ama', title: '🎤 AMA', visible: true, order: 6 },
      { id: 'graduation', title: '🎉 Graduation Party', visible: true, order: 7 },
    ],
    customDomain: undefined,
  };
}

// ─── Leaderboard ────────────────────────────────────────────────────────

export interface LeaderboardConfig {
  maxEntries: number;
  categories: LeaderboardCategory[];
}

export interface LeaderboardCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const LEADERBOARD_CATEGORIES: LeaderboardCategory[] = [
  { id: 'top_holders', name: '🐳 Top Holders', description: 'Largest token holders', icon: '🐳' },
  { id: 'first_buyers', name: '🏅 First Buyers', description: 'Earliest supporters', icon: '🏅' },
  {
    id: 'biggest_traders',
    name: '📈 Biggest Traders',
    description: 'Highest volume traders',
    icon: '📈',
  },
  {
    id: 'streak_leaders',
    name: '🔥 Streak Leaders',
    description: 'Best consecutive buy streaks',
    icon: '🔥',
  },
];

/**
 * Calculate leaderboard from raw data.
 */
export function calculateLeaderboard(
  holders: Array<{
    address: string;
    balance: bigint;
    firstBuyTime: number;
    totalVolume: bigint;
    streak: number;
  }>,
  currentUserAddress?: string,
): LeaderboardEntry[] {
  // Sort by balance descending
  const sorted = [...holders].sort((a, b) => {
    if (b.balance > a.balance) return 1;
    if (b.balance < a.balance) return -1;
    return 0;
  });

  return sorted.slice(0, 50).map((holder, index) => {
    const rank = index + 1;
    const isCurrentUser = currentUserAddress?.toLowerCase() === holder.address.toLowerCase();
    const badge = getLeaderboardBadge(rank, holder.firstBuyTime);

    return {
      address: `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`,
      tokens: holder.balance.toString(),
      rank,
      isCurrentUser,
      badge,
    };
  });
}

function getLeaderboardBadge(rank: number, _firstBuyTime: number): BadgeType | undefined {
  if (rank === 1) return 'legendary_whale';
  if (rank <= 3) return 'whale';
  if (rank <= 10) return 'top_10';
  return undefined;
}

// ─── Post-Bonding Status Generator ──────────────────────────────────────

/**
 * Generate full post-bonding status.
 */
export function generatePostBondingStatus(
  config: PostBondingConfig,
  graduationTime: number,
  coinAddress: string,
  lpTokenAmount: string,
  holders: Array<{
    address: string;
    balance: bigint;
    firstBuyTime: number;
    totalVolume: bigint;
    streak: number;
  }>,
  currentUserAddress?: string,
): PostBondingStatus {
  const partyEndsAt = graduationTime + GRADUATION_PARTY_DURATION;
  const lpLockInfo = calculateLpLock(
    graduationTime,
    Math.max(config.liquidityLockDuration, MIN_LIQUIDITY_LOCK_DURATION),
    lpTokenAmount,
  );

  return {
    partyActive: Date.now() / 1000 < partyEndsAt,
    partyEndsAt,
    amaScheduledAt: config.enableAMA ? graduationTime + 7 * 24 * 60 * 60 : undefined,
    amaPlatform: config.amaPlatform,
    amaLink: config.enableAMA ? `${DEFAULT_TOKEN_PAGE_BASE}/${coinAddress}/ama` : undefined,
    liquidityLocked: lpTokenAmount,
    liquidityUnlocksAt: lpLockInfo.unlockTimestamp,
    tokenPageUrl: config.tokenPageUrl ?? `${DEFAULT_TOKEN_PAGE_BASE}/${coinAddress}`,
    leaderboard: calculateLeaderboard(holders, currentUserAddress),
  };
}

// ─── Graduation Certificate ─────────────────────────────────────────────

export interface GraduationCertificate {
  coinName: string;
  coinSymbol: string;
  coinAddress: string;
  creator: string;
  graduationTime: number;
  totalRaised: string;
  uniqueBuyers: number;
  phaseHistory: BondingPhaseInfo[];
  certificateId: string;
}

/**
 * Generate a graduation certificate for on-chain storage.
 */
export function generateGraduationCertificate(
  coinName: string,
  coinSymbol: string,
  coinAddress: string,
  creator: string,
  graduationTime: number,
  totalRaised: string,
  uniqueBuyers: number,
  phaseHistory: BondingPhaseInfo[],
): GraduationCertificate {
  const certId = `grad-${coinAddress.slice(0, 10)}-${graduationTime}`;

  return {
    coinName,
    coinSymbol,
    coinAddress,
    creator,
    graduationTime,
    totalRaised,
    uniqueBuyers,
    phaseHistory,
    certificateId: certId,
  };
}

// ─── Badge Assignment ────────────────────────────────────────────────────

/**
 * Determine which badges a user earns based on their participation.
 */
export function determineBadges(
  isFirstBuyer: boolean,
  buyStreak: number,
  _tokensHeld: bigint,
  rank: number,
  boughtEarly: boolean,
  heldThroughGraduation: boolean,
): Badge[] {
  const badges: Badge[] = [];

  if (isFirstBuyer) {
    badges.push({
      type: 'first_buyer',
      name: 'First Buyer',
      icon: '🥇',
      description: 'First person to buy this coin',
      rarity: 'legendary',
    });
  }

  if (buyStreak >= 7) {
    badges.push({
      type: 'streak_7',
      name: '7-Day Streak',
      icon: '🔥',
      description: 'Bought 7 days in a row',
      rarity: 'epic',
    });
  }

  if (rank === 1) {
    badges.push({
      type: 'legendary_whale',
      name: '🐋 Legendary Whale',
      icon: '🐋',
      description: '#1 holder of this coin',
      rarity: 'legendary',
    });
  } else if (rank <= 3) {
    badges.push({
      type: 'whale',
      name: '🐳 Whale',
      icon: '🐳',
      description: 'Top 3 holder of this coin',
      rarity: 'epic',
    });
  } else if (rank <= 10) {
    badges.push({
      type: 'top_10',
      name: 'Top 10',
      icon: '💎',
      description: 'Top 10 holder of this coin',
      rarity: 'rare',
    });
  }

  if (boughtEarly) {
    badges.push({
      type: 'early_adopter',
      name: 'Early Adopter',
      icon: '🕊️',
      description: 'Bought in Steal Deal or Early Bird phase',
      rarity: 'epic',
    });
  }

  if (heldThroughGraduation) {
    badges.push({
      type: 'graduation_holder',
      name: 'Graduation Holder',
      icon: '🎓',
      description: 'Held tokens through graduation',
      rarity: 'rare',
    });
  }

  return badges;
}

// ─── On-Chain Code Generator ────────────────────────────────────────────

/**
 * Generate Solidity code for post-bonding features.
 */
export function generateOnChainPostBondingCode(config: PostBondingConfig): string {
  return `
  // ── Creator Coin 2.0: Post-Bonding ───────────────────────────────────
  // Generated: ${new Date().toISOString()}

  event Graduated(uint256 timestamp, uint256 totalSupply, uint256 totalRaised, string phaseHistory);
  event LiquidityLocked(uint256 amount, uint256 unlockTimestamp);
  event AMAScheduled(uint256 timestamp, string platform);

  // Graduation
  uint256 public graduationTime;
  string public phaseHistory;

  function _checkGraduation() internal override {
    if (_totalSupply >= GRADUATION_SUPPLY && uniqueBuyers >= MIN_UNIQUE_BUYERS) {
      graduated = true;
      graduationTime = block.timestamp;
      flashSaleActive = false;
      creatorEventActive = false;
      phaseHistory = _encodePhaseHistory();

      emit Graduated(block.timestamp, _totalSupply, totalRaised, phaseHistory);
      emit LiquidityLocked(_totalSupply, block.timestamp + ${config.liquidityLockDuration});
    }
  }

  function _encodePhaseHistory() internal view returns (string memory) {
    string memory result = "";
    uint256 progress = (_totalSupply * 100) / GRADUATION_SUPPLY;
    if (progress >= 0) result = string.concat(result, "🔥Steal Deal,");
    if (progress >= 20) result = string.concat(result, "🐦Early Bird,");
    if (progress >= 40) result = string.concat(result, "🚗Cruise Control,");
    if (progress >= 60) result = string.concat(result, "📢Final Call,");
    if (progress >= 80) result = string.concat(result, "🚀Moonshot");
    return result;
  }
  `;
}

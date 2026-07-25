export interface ReputationRecord {
  userId: string;
  total: number;
  level: string;
  lastActiveAt: number;
  joinedAt: number;
  consecutiveVotes: number;
}
export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  awardedAt: number | null;
}
export interface LeaderboardEntry {
  userId: string;
  rank: number;
  score: number;
  level: string;
  change: number;
  displayName?: string;
}
export interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
}
export interface ChallengeState {
  progress: Record<string, number>;
  completed: string[];
  allDone: boolean;
}
export type TimePeriod = 'weekly' | 'monthly' | 'alltime';
export interface ActivityItem {
  id: string;
  type: string;
  display: string;
  timestamp: number;
}

export interface Level {
  id: string;
  label: string;
  icon: string;
  minScore: number;
  maxScore: number;
  color: string;
}
export const LEVELS: Level[] = [
  {
    id: 'contributor',
    label: 'Contributor',
    icon: '🥉',
    minScore: 0,
    maxScore: 100,
    color: '#CD7F32',
  },
  {
    id: 'active_member',
    label: 'Active Member',
    icon: '🥈',
    minScore: 101,
    maxScore: 300,
    color: '#C0C0C0',
  },
  {
    id: 'core_member',
    label: 'Core Member',
    icon: '🥇',
    minScore: 301,
    maxScore: 600,
    color: '#FFD700',
  },
  { id: 'guardian', label: 'Guardian', icon: '💎', minScore: 601, maxScore: 900, color: '#00CED1' },
  { id: 'steward', label: 'Steward', icon: '👑', minScore: 901, maxScore: 1000, color: '#8A2BE2' },
];

export function getLevel(score: number): Level {
  for (const l of LEVELS) {
    if (score >= l.minScore && score <= l.maxScore) return l;
  }
  return LEVELS[0]!;
}
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
export function formatScore(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

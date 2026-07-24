export interface TopPost {
  id: string;
  protocol: string;
  content: string;
  likes: number;
  reposts: number;
  replies: number;
  tips: number;
  tipsUsd: number;
  createdAt: string;
}

export interface ProtocolEngagement {
  likes: number;
  reposts: number;
  replies: number;
}

export interface AnalyticsData {
  followers: {
    total: number;
    byProtocol: Record<string, number>;
    growth30d: number[];
    growthLabels: string[];
  };
  posts: {
    total: number;
    byDay: number[];
    dayLabels: string[];
    byWeekday: number[];
    weekdayLabels: string[];
    totalTopLevel: number;
    totalReplies: number;
  };
  tips: {
    totalUsd: number;
    byCurrency: Record<string, number>;
    byProtocol: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
    totalDegen: number;
    totalEth: number;
    totalSol: number;
    totalBtc: number;
    topTippers: { name: string; totalUsd: number }[];
    last10: { amount: string; currency: string; protocol: string; createdAt: number }[];
  };
  engagement: {
    rate: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    byProtocol: Record<string, ProtocolEngagement>;
  };
  topPosts: TopPost[];
  topTipPosts: TopPost[];
  audience: {
    byProtocol: Record<string, number>;
    byInstance: Record<string, number>;
    locations: Record<string, number>;
    byCommunity: { name: string; count: number }[];
  };
  protocols: {
    connected: string[];
    missing: string[];
  };
  lastUpdated: number;
  isMock: boolean;
}

export type TabId = 'overview' | 'content' | 'audience' | 'earnings';

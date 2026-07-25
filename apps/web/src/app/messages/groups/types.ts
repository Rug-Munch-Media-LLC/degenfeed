export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  lastActivity: number;
  unreadCount: number;
}

export interface GroupInfo {
  name: string;
  description: string;
  members: Array<{
    walletAddress: string;
    displayName?: string;
    joinedAt: number;
    role: 'admin' | 'member';
  }>;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  fromId: string;
  content: string;
  createdAt: number;
}

/**
 * @degenfeed/ui — Lemmy Thread View Types
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ───────────────────────────────────────────────────────────

export interface LemmyComment {
  id: string;
  author: string;
  authorAvatar?: string;
  authorEvmAddress?: string;
  authorSolanaAddress?: string;
  authorProtocol?: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  createdAt: number;
  depth: number;
  replies: LemmyComment[];
  editedAt?: number;
  userVote?: 'up' | 'down' | null;
}

export interface LemmyThreadViewProps {
  post: UnifiedPost;
  comments?: LemmyComment[];
  communityName?: string;
  communityIcon?: string;
  instanceDomain?: string;
}

export interface RawComment {
  id: string;
  author: string;
  author_avatar?: string;
  author_evm_address?: string;
  author_solana_address?: string;
  author_protocol?: string;
  content: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  created_at?: number;
  path?: string;
  parent_id?: string;
  edited?: boolean;
  updated_at?: number;
  my_vote?: number;
}

export interface ParsedMedia {
  images: string[];
  videos: string[];
  links: { url: string; text: string }[];
}

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export interface ReplyFormProps {
  parentId: string;
  authorName: string;
  onClose: () => void;
}

export interface ImagePreviewProps {
  src: string;
}

export interface VideoPreviewProps {
  url: string;
}

export interface LinkPreviewProps {
  url: string;
}

export interface CommentNodeProps {
  comment: LemmyComment;
  depth: number;
  fallbackEvmAddress?: string;
  fallbackSolanaAddress?: string;
  userVote?: 'up' | 'down' | null;
  onVote?: (commentId: string, direction: 'up' | 'down' | null) => void;
}

export interface VirtualizedCommentListProps {
  comments: LemmyComment[];
  depth: number;
  fallbackEvmAddress?: string;
  fallbackSolanaAddress?: string;
  onVote?: (commentId: string, direction: 'up' | 'down' | null) => void;
}

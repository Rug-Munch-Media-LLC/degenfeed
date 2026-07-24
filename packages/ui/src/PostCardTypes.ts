/**
 * @degenfeed/ui — PostCard Types
 */

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import type { ReputationBadgeProgress, ReputationBadgeScore } from './ReputationBadge';

export type { ReportModalProps } from './ReportModal';
export type { UnifiedPost };

export interface EngageResult {
  ok: boolean;
  error?: string;
}

export type EngageHandler = (
  action: EngagementAction,
  postId: string,
  content?: string,
) => Promise<EngageResult> | EngageResult;

export interface PostCardProps {
  post: UnifiedPost;
  onEngage?: EngageHandler;
  onClick?: (postId: string) => void;
  expanded?: boolean;
  onTip?: (post: UnifiedPost) => void;
  onPaywall?: (post: UnifiedPost) => void;
  viewerProtocols?: string[];
  onReport?: (postId: string) => void;
  crossProtocolBadges?: string[];
  onTranslatePublish?: (content: string, targetProtocol: string) => void;
  onCrossReplyOpen?: (post: UnifiedPost) => void;
  isAdmin?: boolean;
  onAdminRemove?: (postId: string) => void;
  onAdminBan?: (userId: string, protocol: string, handle?: string) => void;
  reputation?: ReputationBadgeScore | null;
  onContextMenu?: (e: React.MouseEvent, postId: string) => void;
  reputationProgress?: ReputationBadgeProgress | null;
  onShowMoreLikeThis?: (topic: string) => void;
  onShowLessLikeThis?: (topic: string) => void;
  onWhyThisPost?: (post: UnifiedPost) => void;
  onOpenShareSheet?: (post: UnifiedPost) => void;
}

export interface LocalState {
  engagement: UnifiedPost['engagement'];
  metrics: UnifiedPost['metrics'];
}

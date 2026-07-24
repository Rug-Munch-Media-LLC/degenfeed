'use client';

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { memo } from 'react';
import { PostCardEngagement, type PostCardEngagementProps } from '../PostCardEngagement';

export interface PostActionsProps {
  post: UnifiedPost;
  localState: PostCardEngagementProps['localState'];
  bridgeReplies: Record<string, number> | null;
  showReply: boolean;
  replyText: string;
  animatingLike: boolean;
  onPerform: (action: EngagementAction, content?: string) => Promise<void> | void;
  onSetShowReply: (v: boolean) => void;
  onSetReplyText: (v: string) => void;
  onShare: () => void;
  onTip?: (post: UnifiedPost) => void;
  onCrossReplyOpen?: (post: UnifiedPost) => void;
  onOpenShareSheet?: () => void;
}

export const PostActions = memo(function PostActions(props: PostActionsProps) {
  const {
    post,
    localState,
    bridgeReplies,
    showReply,
    replyText,
    animatingLike,
    onPerform,
    onSetShowReply,
    onSetReplyText,
    onShare,
    onTip,
    onCrossReplyOpen,
    onOpenShareSheet,
  } = props;

  const engagementProps: PostCardEngagementProps = {
    post,
    localState,
    bridgeReplies,
    showReply,
    replyText,
    animatingLike,
    onPerform,
    onSetShowReply,
    onSetReplyText,
    onShare,
    onTip,
    onCrossReplyOpen,
    onOpenShareSheet,
  };

  return <PostCardEngagement {...engagementProps} />;
});

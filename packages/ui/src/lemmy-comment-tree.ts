/**
 * @degenfeed/ui — Lemmy Comment Tree Builder
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { LemmyComment, RawComment } from './lemmy-types';

export function extractComments(post: UnifiedPost): LemmyComment[] {
  const raw = post.raw as Record<string, unknown> | undefined;
  if (raw?.comments && Array.isArray(raw.comments)) {
    const rawComments = raw.comments as RawComment[];
    const votes = rawComments.map((c) => c.my_vote ?? null);
    return buildCommentTree(rawComments, votes);
  }
  return [];
}

export function buildCommentTree(
  flat: RawComment[],
  userVotes?: (number | null)[],
): LemmyComment[] {
  const map = new Map<string, LemmyComment & { parentId?: string }>();
  const roots: LemmyComment[] = [];

  const voteIndex = new Map<string, 'up' | 'down' | null>();
  if (userVotes && userVotes.length === flat.length) {
    flat.forEach((rc, i) => {
      const v = userVotes[i];
      if (v !== undefined) {
        if (v === 1) voteIndex.set(rc.id, 'up');
        else if (v === -1) voteIndex.set(rc.id, 'down');
        else voteIndex.set(rc.id, null);
      }
    });
  }

  for (const rc of flat) {
    const userVote = voteIndex.get(rc.id) as 'up' | 'down' | null | undefined;
    map.set(rc.id, {
      id: rc.id,
      author: rc.author,
      authorAvatar: rc.author_avatar,
      authorEvmAddress: rc.author_evm_address,
      authorSolanaAddress: rc.author_solana_address,
      authorProtocol: rc.author_protocol,
      content: rc.content,
      score: rc.score ?? (rc.upvotes ?? 0) - (rc.downvotes ?? 0),
      upvotes: rc.upvotes ?? 0,
      downvotes: rc.downvotes ?? 0,
      createdAt: Number(rc.created_at) || Date.now(),
      editedAt: rc.edited || rc.updated_at ? Number(rc.updated_at) || undefined : undefined,
      depth: rc.path ? rc.path.split('.').length - 2 : 0,
      replies: [],
      parentId: rc.parent_id,
      userVote: userVote ?? null,
    });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.replies.push(node as LemmyComment);
    } else {
      roots.push(node as LemmyComment);
    }
  }

  return roots;
}

export function extractLemmyData(post: UnifiedPost): {
  communityName: string;
  communityIcon?: string;
  instanceDomain: string;
} {
  const raw = post.raw as Record<string, unknown> | undefined;
  return {
    communityName:
      (raw?.community_name as string) ??
      (raw?.community as Record<string, string> | undefined)?.name ??
      'c/crypto',
    communityIcon: raw?.community_icon as string | undefined,
    instanceDomain:
      (raw?.instance_domain as string) ?? (raw?.instance as string) ?? 'lemmy.degenfeed.xyz',
  };
}

/**
 * @degenfeed/ui — PostCard component tests
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostCard, type PostCardProps } from './PostCard';

// ─── Test Helpers ─────────────────────────────────────────────────

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nostr:test123',
    protocol: 'nostr',
    author: {
      id: 'nostr:author1',
      primary: { protocol: 'nostr', id: 'author1' },
      handles: { nostr: '@author1' },
      displayName: 'Test Author',
      bio: 'A test author',
      avatarUrl: '',
      verified: [],
      followerCount: 100,
      followingCount: 50,
      links: [],
      keys: {},
    },
    text: 'This is a test post about Bitcoin and Ethereum',
    html: undefined,
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 10, reposts: 5, replies: 3, quotes: 1 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 10, reposts: 5, replies: 3, quotes: 1 },
    },
    raw: null,
    niches: ['crypto', 'bitcoin'],
    parentId: undefined,
    rootId: undefined,
    dfUri: 'df://nostr:test123',
    score: undefined,
    qualityBadge: undefined,
    qualityScore: undefined,
    ...overrides,
  } as Parameters<typeof PostCard>[0]['post'];
}

function renderPostCard(props: Partial<PostCardProps> = {}) {
  const defaults: PostCardProps = {
    post: makePost(),
    onEngage: vi.fn(),
    onClick: vi.fn(),
    onTip: vi.fn(),
  };
  return render(<PostCard {...defaults} {...props} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PostCard', () => {
  it('should render author display name', () => {
    renderPostCard();
    expect(screen.getByText('Test Author')).toBeDefined();
  });

  it('should render post text content', () => {
    renderPostCard();
    expect(screen.getByText('This is a test post about Bitcoin and Ethereum')).toBeDefined();
  });

  it('should render time ago', () => {
    renderPostCard();
    expect(screen.getByText('1h')).toBeDefined();
  });

  it('should render niche tags', () => {
    renderPostCard();
    expect(screen.getByText('crypto')).toBeDefined();
    expect(screen.getByText('bitcoin')).toBeDefined();
  });

  it('should render Follow button', () => {
    renderPostCard();
    expect(screen.getByText('+ Follow')).toBeDefined();
  });

  it('should render Mute button', () => {
    renderPostCard();
    const muteButtons = screen.getAllByText('🔇');
    expect(muteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('should call onClick when post is clicked', () => {
    const onClick = vi.fn();
    renderPostCard({ onClick });
    const article = screen.getByLabelText('Post by Test Author');
    fireEvent.click(article);
    expect(onClick).toHaveBeenCalledWith('nostr:test123');
  });

  it('should show "Show more" button for long posts', () => {
    const longText = 'x'.repeat(600);
    const post = makePost({ text: longText });
    renderPostCard({ post });
    expect(screen.getByText('Show more')).toBeDefined();
  });

  it('should not show "Show more" for short posts', () => {
    renderPostCard();
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('should show quality badge when qualityBadge is "verified"', () => {
    const post = makePost({
      qualityBadge: 'verified',
      qualityScore: { score: 5, max: 8, ratio: 0.625, reasons: ['test'], badge: 'verified' },
    });
    renderPostCard({ post });
    expect(screen.getByText(/Verified/)).toBeDefined();
  });

  it('should show score badge when score is present', () => {
    const post = makePost({
      score: {
        total: 8.5,
        recency: 2,
        engagement: 3,
        relevance: 2,
        quality: 1,
        source: 0.5,
        velocity: 0,
        reasons: ['test'],
      },
    });
    renderPostCard({ post });
    expect(screen.getByText(/★/)).toBeDefined();
  });

  it('should show hot badge when post is trending', () => {
    const post = makePost({ isHot: true });
    renderPostCard({ post });
    expect(screen.getByText(/Hot/)).toBeDefined();
  });

  it('should render protocol badge', () => {
    renderPostCard();
    // ProtocolBadge renders the protocol name or icon
    expect(screen.getByText('⚡')).toBeDefined(); // nostr emoji
  });

  it('should have accessible aria-label', () => {
    renderPostCard();
    expect(screen.getByLabelText('Post by Test Author')).toBeDefined();
  });

  it('should render Tip button', () => {
    renderPostCard();
    expect(screen.getByText('⚡Tip')).toBeDefined();
  });
});

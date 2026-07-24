/**
 * @degenfeed/ui — FeedList component tests
 *
 * Covers all four visual states (loading, error, empty, loaded),
 * scroll-position restore, hasMore sentinel, and keyboard navigation.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedListProps } from './FeedList';
import { FeedList } from './FeedList';

// ─── Helpers ─────────────────────────────────────────────────────────

function makePost(id: string, overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id,
    protocol: 'nostr',
    author: {
      id: `nostr:${id}`,
      primary: { protocol: 'nostr', id },
      handles: { nostr: `@${id}` },
      displayName: `User ${id}`,
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: `Post body ${id}`,
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
    niches: [],
    ...overrides,
  };
}

function renderFeedList(props: Partial<FeedListProps> = {}) {
  const defaults: FeedListProps = {
    state: 'loaded',
    posts: [],
    onRetry: vi.fn(),
    onPostClick: vi.fn(),
    onTip: vi.fn(),
    onEngage: vi.fn(),
  };
  return render(<FeedList {...defaults} {...props} />);
}

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

// ─── Loading state ────────────────────────────────────────────────────

describe('loading state', () => {
  it('should render 5 skeleton cards when state is "loading"', () => {
    const { container } = renderFeedList({ state: 'loading', posts: [] });
    const skeletons = container.querySelectorAll('.skeleton-shimmer');
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('should set aria-label to "Loading content"', () => {
    renderFeedList({ state: 'loading' });
    const output = screen.getByLabelText('Loading content');
    expect(output).toBeDefined();
  });

  it('should ignore posts array when in loading state', () => {
    const posts = [makePost('p1'), makePost('p2')];
    const { container } = renderFeedList({ state: 'loading', posts });
    // Should still show skeletons, not post cards
    const skeletons = container.querySelectorAll('.skeleton-shimmer');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// ─── Error state ──────────────────────────────────────────────────────

describe('error state', () => {
  it('should render error message when state is "error"', () => {
    renderFeedList({ state: 'error', error: 'Something went wrong' });
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('should render default error text when no error message provided', () => {
    renderFeedList({ state: 'error' });
    expect(screen.getByText('Could not load the feed')).toBeDefined();
  });

  it('should call onRetry when "Try again" button is clicked', () => {
    const onRetry = vi.fn();
    renderFeedList({ state: 'error', onRetry });
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ─── Empty state ──────────────────────────────────────────────────────

describe('empty state', () => {
  it('should render empty state message when state is "empty"', () => {
    renderFeedList({ state: 'empty', posts: [] });
    expect(screen.getByText('The feed is warming up')).toBeDefined();
  });

  it('should show protocol-specific empty message when protocolLabel is set', () => {
    renderFeedList({ state: 'empty', posts: [], protocolLabel: 'Nostr' });
    expect(screen.getByText('No Nostr posts yet')).toBeDefined();
  });

  it('should show sign-in button when onSignIn is provided', () => {
    const onSignIn = vi.fn();
    renderFeedList({ state: 'empty', posts: [], onSignIn });
    expect(screen.getByText('Sign in to compose')).toBeDefined();
  });

  it('should not show sign-in button when onSignIn is omitted', () => {
    renderFeedList({ state: 'empty', posts: [] });
    expect(screen.queryByText('Sign in to compose')).toBeNull();
  });
});

// ─── Loaded state ─────────────────────────────────────────────────────

describe('loaded state', () => {
  it('should render PostCard for each post', () => {
    const posts = [makePost('p1'), makePost('p2'), makePost('p3')];
    renderFeedList({ state: 'loaded', posts });
    for (const post of posts) {
      expect(screen.getByText(post.text)).toBeDefined();
    }
  });

  it('should set role="feed" on the container', () => {
    const posts = [makePost('p1')];
    renderFeedList({ state: 'loaded', posts });
    expect(screen.getByRole('feed')).toBeDefined();
  });

  it('should fire onPostClick when a post is clicked', () => {
    const onPostClick = vi.fn();
    const posts = [makePost('p1')];
    renderFeedList({ state: 'loaded', posts, onPostClick });

    // Click the post body text — PostCard passes the click through
    fireEvent.click(screen.getByText('Post body p1'));
    expect(onPostClick).toHaveBeenCalledWith('p1');
  });

  it('should display loading-more indicator when hasMore is true', () => {
    const posts = [makePost('p1')];
    renderFeedList({ state: 'loaded', posts, hasMore: true });
    expect(screen.getByText('Loading more…')).toBeDefined();
  });

  it('should not display loading-more indicator when hasMore is false', () => {
    const posts = [makePost('p1')];
    renderFeedList({ state: 'loaded', posts, hasMore: false });
    expect(screen.queryByText('Loading more…')).toBeNull();
  });

  it('should restore scroll position if saved in sessionStorage', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    // Mock requestAnimationFrame to execute callbacks synchronously
    const rafMock = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    sessionStorage.setItem('df_scroll', JSON.stringify({ y: 500, id: 'p2' }));

    const posts = [makePost('p1'), makePost('p2'), makePost('p3')];
    renderFeedList({ state: 'loaded', posts });

    // FeedList tries to scroll to the post with matching id
    expect(scrollIntoViewMock).toHaveBeenCalled();

    rafMock.mockRestore();
  });
});

// ─── Keyboard navigation ─────────────────────────────────────────────

describe('keyboard navigation', () => {
  /** Helper: get the FeedList-level article elements (with data-post-id) */
  function getFeedArticles(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-post-id]'));
  }

  it('should focus the next article on "j" key press', () => {
    const posts = [makePost('p1'), makePost('p2')];
    const { container } = renderFeedList({ state: 'loaded', posts });

    const articles = getFeedArticles(container);
    expect(articles.length).toBe(2);

    // Focus the first article
    (articles[0] as HTMLElement).focus();
    expect(document.activeElement).toBe(articles[0]);

    // Press 'j' — should move to next article
    fireEvent.keyDown(window, { key: 'j' });
    expect(document.activeElement).toBe(articles[1]);
  });

  it('should focus the previous article on "k" key press', () => {
    const posts = [makePost('p1'), makePost('p2'), makePost('p3')];
    const { container } = renderFeedList({ state: 'loaded', posts });

    const articles = getFeedArticles(container);
    // Focus the second article
    (articles[1] as HTMLElement).focus();
    expect(document.activeElement).toBe(articles[1]);

    // Press 'k' — should move to previous
    fireEvent.keyDown(window, { key: 'k' });
    expect(document.activeElement).toBe(articles[0]);
  });

  it('should not navigate when focus is in an input field', () => {
    const posts = [makePost('p1'), makePost('p2')];
    renderFeedList({ state: 'loaded', posts });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Fire keydown on the input — it bubbles to window where the handler
    // checks e.target instanceof HTMLInputElement and bails out.
    // Focus should remain on the input.
    fireEvent.keyDown(input, { key: 'j' });
    expect(document.activeElement).toBe(input);
    document.body.removeChild(input);
  });

  it('should not navigate past the last article', () => {
    const posts = [makePost('p1')];
    const { container } = renderFeedList({ state: 'loaded', posts });
    const articles = getFeedArticles(container);

    (articles[0] as HTMLElement).focus();

    // Press 'j' — only one article, should stay on it
    fireEvent.keyDown(window, { key: 'j' });
    expect(document.activeElement).toBe(articles[0]);
  });

  it('should not navigate before the first article', () => {
    const posts = [makePost('p1'), makePost('p2')];
    const { container } = renderFeedList({ state: 'loaded', posts });
    const articles = getFeedArticles(container);

    (articles[0] as HTMLElement).focus();

    // Press 'k' — already at first, should stay
    fireEvent.keyDown(window, { key: 'k' });
    expect(document.activeElement).toBe(articles[0]);
  });
});

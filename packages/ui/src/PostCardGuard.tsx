'use client';

/**
 * @degenfeed/ui — PostCardGuard
 *
 * Per-post error boundary. One malformed/broken post must never take down
 * the whole feed: when a PostCard throws during render, this boundary
 * catches it, logs it, and renders a slim "skipped post" placeholder so the
 * rest of the timeline keeps rendering normally.
 *
 * Usage: wrap each PostCard in a <PostCardGuard key={post.id} postId={post.id}>.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PostCardGuardProps {
  children: ReactNode;
  /** Post id used for the skip placeholder + logging. */
  postId: string;
  /** Optional custom fallback rendered instead of the default skip row. */
  fallback?: (error: Error, postId: string) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface PostCardGuardState {
  hasError: boolean;
  error: Error | null;
}

export class PostCardGuard extends Component<PostCardGuardProps, PostCardGuardState> {
  override state: PostCardGuardState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): PostCardGuardState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PostCardGuard] skipping post ${this.props.postId}`, error, info.componentStack);
    this.props.onError?.(error, info);
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.props.postId);
      }
      return (
        <article
          data-post-id={this.props.postId}
          data-skipped-post="true"
          className="border-b border-[var(--color-glass-border)] px-4 py-6 text-center"
          aria-label="A post could not be displayed and was skipped"
        >
          <p className="text-xs text-[var(--color-muted)]">
            A post couldn&apos;t be displayed and was skipped.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Try rendering it again
          </button>
        </article>
      );
    }
    return this.props.children;
  }
}

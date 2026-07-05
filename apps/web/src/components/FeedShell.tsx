"use client";

/**
 * DegenFeed — Main App Shell
 *
 * Client component that provides auth context and renders the feed.
 * Wraps the entire /home area with AuthProvider.
 */

import { AuthProvider } from "./AuthProvider";

export function FeedShell({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

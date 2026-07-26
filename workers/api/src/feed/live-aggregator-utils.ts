/**
 * @degenfeed/api-worker — Live Aggregator Utilities
 *
 * Helper functions for PeerTube category resolution, SSE formatting, and IDs.
 */

/**
 * Resolve a human-readable category to a PeerTube category number.
 */
export function resolvePeerTubeCategory(category: string): number {
  const map: Record<string, number> = {
    gaming: 10,
    music: 11,
    'talk shows & podcasts': 12,
    tech: 13,
    education: 14,
    sports: 15,
    art: 16,
    irl: 17,
    trading: 18,
    crypto: 19,
  };
  return map[category.toLowerCase()] ?? 13;
}

/**
 * SSE-formatted viewer count stream data.
 */
export function formatViewerSSE(streamId: string, viewerCount: number): string {
  return `data: ${JSON.stringify({ streamId, viewerCount, timestamp: Date.now() })}\n\n`;
}

/**
 * Generate a unique stream/schedule ID.
 */
export function generateLiveId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

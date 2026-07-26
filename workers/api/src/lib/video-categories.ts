/**
 * @degenfeed/api-worker — Video Categories & Categorization Engine
 *
 * Universal video category system that applies to ALL video sources:
 * YouTube, PeerTube, Shorts, Live Streams.
 *
 * Auto-categorization via keyword matching on title/description/tags.
 * Trending category detection based on engagement velocity.
 * User preference based category suggestions.
 */

// ─── Video Categories ─────────────────────────────────────────────────────

export const VIDEO_CATEGORIES = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#9146FF' },
  { id: 'music', label: 'Music', icon: '🎵', color: '#FF4081' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '🪙', color: '#0052FF' },
  { id: 'tech', label: 'Tech & Coding', icon: '💻', color: '#00BCD4' },
  { id: 'art', label: 'Art & Creative', icon: '🎨', color: '#FF6B35' },
  { id: 'education', label: 'Education', icon: '📚', color: '#2196F3' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#E91E63' },
  { id: 'sports', label: 'Sports', icon: '⚽', color: '#F44336' },
  { id: 'news', label: 'News & Politics', icon: '📰', color: '#607D8B' },
  { id: 'science', label: 'Science & Tech', icon: '🔬', color: '#4CAF50' },
  { id: 'comedy', label: 'Comedy', icon: '😂', color: '#FFC107' },
  { id: 'irl', label: 'IRL & Lifestyle', icon: '🌍', color: '#00C853' },
  { id: 'talk', label: 'Talk & Podcasts', icon: '🎙️', color: '#FFD600' },
  { id: 'trading', label: 'Trading & Finance', icon: '📈', color: '#FF5722' },
] as const;

export type VideoCategoryId = (typeof VIDEO_CATEGORIES)[number]['id'];

// ─── Sub-categories ───────────────────────────────────────────────────────

export const SUB_CATEGORIES: Record<string, string[]> = {

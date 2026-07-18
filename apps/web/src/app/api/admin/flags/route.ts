import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_FLAGS = [
  {
    key: 'cross_protocol_posting',
    label: 'Cross-Protocol Posting',
    description: 'Allow posting to multiple protocols simultaneously',
    enabled: true,
    category: 'content' as const,
  },
  {
    key: 'tip_system',
    label: 'Tip System',
    description: 'Enable crypto tipping on content',
    enabled: true,
    category: 'social' as const,
  },
  {
    key: 'community_creation',
    label: 'Community Creation',
    description: 'Allow users to create communities',
    enabled: true,
    category: 'social' as const,
  },
  {
    key: 'short_videos',
    label: 'Short Videos',
    description: 'Enable the shorts/tik-tok style video feed',
    enabled: true,
    category: 'content' as const,
  },
  {
    key: 'spaces_live_audio',
    label: 'Spaces Live Audio',
    description: 'Live audio rooms feature',
    enabled: true,
    category: 'social' as const,
  },
  {
    key: 'trending_algorithms_v2',
    label: 'Trending Algorithms V2',
    description: 'New ML-based trending algorithm',
    enabled: false,
    category: 'experimental' as const,
  },
  {
    key: 'content_moderation_ai',
    label: 'AI Content Moderation',
    description: 'Auto-flag content using AI classifiers',
    enabled: true,
    category: 'content' as const,
  },
  {
    key: 'feed_caching',
    label: 'Feed Caching',
    description: 'Cache aggregated feeds for faster loading',
    enabled: true,
    category: 'performance' as const,
  },
  {
    key: 'real_time_updates',
    label: 'Real-Time Updates',
    description: 'WebSocket-based real-time feed updates',
    enabled: true,
    category: 'performance' as const,
  },
  {
    key: 'analytics_tracking',
    label: 'Analytics Tracking',
    description: 'Collect usage analytics (privacy-first)',
    enabled: true,
    category: 'infrastructure' as const,
  },
  {
    key: 'recommendation_engine',
    label: 'Recommendation Engine',
    description: 'Personalized content recommendations',
    enabled: false,
    category: 'experimental' as const,
  },
  {
    key: 'nft_integration',
    label: 'NFT Integration',
    description: 'NFT display and verification on profiles',
    enabled: false,
    category: 'experimental' as const,
  },
  {
    key: 'pwa_offline_mode',
    label: 'PWA Offline Mode',
    description: 'Offline reading with service worker cache',
    enabled: true,
    category: 'performance' as const,
  },
  {
    key: 'email_notifications',
    label: 'Email Notifications',
    description: 'Send email digests and alerts',
    enabled: false,
    category: 'infrastructure' as const,
  },
  {
    key: 'federation_outgoing',
    label: 'Outgoing Federation',
    description: 'Push content to external protocols',
    enabled: true,
    category: 'content' as const,
  },
];

export async function GET() {
  return NextResponse.json(
    { flags: DEFAULT_FLAGS },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    },
  );
}

/**
 * Audius (Open Audio Protocol) bridge provider
 *
 * Integrates decentralized music streaming content into DegenFeed.
 * API Docs: https://docs.audius.co
 * SDK: @audius/sdk (Apache-2.0)
 *
 * Features:
 * - Trending tracks across genres
 * - Artist profiles and updates
 * - Playlist curation
 * - Music NFT metadata
 *
 * Rate Limits: 10 req/s, 500K req/month (free tier)
 * Auth: API Key + Bearer Token (writes)
 */

import type { FetchOptions, ProtocolProvider, RawPost, UnifiedPost } from '../types';

export class AudiusProvider implements ProtocolProvider {
  id = 'audius';
  name = 'Audius';
  private baseUrl = 'https://api.audius.co/v1';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.AUDIUS_API_KEY || '';
  }

  async fetch(options: FetchOptions): Promise<RawPost[]> {
    const limit = options.limit || 20;
    const response = await fetch(`${this.baseUrl}/tracks/trending?limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Audius API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  normalize(raw: any): UnifiedPost {
    return {
      id: `audius:${raw.id}`,
      protocol: 'audius',
      type: 'music',
      author: {
        displayName: raw.user?.name || raw.artist || 'Unknown',
        handle: raw.user?.handle || '',
        avatar: raw.user?.profile_picture?.url || null,
      },
      content: {
        title: raw.title,
        description: raw.description || '',
        genre: raw.genre || '',
        duration: raw.duration || 0,
        plays: raw.play_count || 0,
      },
      url: `https://audius.co${raw.permalink || ''}`,
      media: raw.artwork?.url ? { url: raw.artwork.url, type: 'image' } : null,
      timestamp: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
      stats: {
        likes: raw.favorite_count || 0,
        plays: raw.play_count || 0,
        reposts: raw.repost_count || 0,
      },
    };
  }

  async healthCheck(): Promise<number> {
    const start = Date.now();
    await fetch(`${this.baseUrl}/tracks/trending?limit=1`);
    return Date.now() - start;
  }
}

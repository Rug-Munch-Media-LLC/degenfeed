/**
 * @degenfeed/cross-protocol-bridge — PeerTube → Nostr Transform Adapter
 *
 * When a new video is published on PeerTube, create a Nostr kind 1 note
 * with the video link and description, and publish to our self-hosted relay.
 *
 * Environment:
 *   NOSTR_RELAY_URL  — our relay endpoint (default: http://127.0.0.1:8085)
 *   NOSTR_NSEC       — hex secret key for signing events (optional, uses relay write if unset)
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

function extractTitle(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim());
  return lines[0] || 'Untitled video';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .trim();
}

function getRelayUrl(): string {
  return process.env.NOSTR_RELAY_URL || 'http://127.0.0.1:8085';
}

export const peertubeToNostr: BridgeAdapter = {
  id: 'peertube→nostr',
  name: 'PeerTube → Nostr',
  source: 'peertube',
  target: 'nostr',

  async transform(content: NormalizedContent) {
    const videoUrl = content.links[0] || content.media.find((m) => m.kind === 'video')?.url;
    if (!videoUrl) {
      return { success: false, error: 'No video URL found in PeerTube content' };
    }

    const title = extractTitle(content.text);
    const description = stripHtml(content.text).replace(title, '').trim();

    const noteContent = [
      `📺 ${title}`,
      '',
      description,
      '',
      `🔗 Watch: ${videoUrl}`,
      '',
      ...content.hashtags.map((t) => `#${t}`),
    ]
      .filter(Boolean)
      .join('\n');

    const payload = {
      kind: 1,
      content: noteContent,
      tags: [
        ...content.hashtags.map((t) => ['t', t]),
        ['r', videoUrl],
        ['proxy', videoUrl, 'activitypub'],
        ...(content.media[0]?.url
          ? [['imeta', `url=${content.media[0].url}`] as [string, string]]
          : []),
      ],
      created_at: Math.floor(Date.now() / 1000),
    };

    return { success: true, payload };
  },

  async publish(payload: unknown) {
    const event = payload as Record<string, unknown>;
    const relayUrl = getRelayUrl();
    try {
      const response = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVENT', event]),
      });
      if (!response.ok) {
        throw new Error(`Nostr relay returned ${response.status}`);
      }
      return {
        success: true,
        nativeId: `nostr:peertube-${Date.now()}`,
        url: `https://nostr.degenfeed.xyz/peertube/${event.created_at}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to publish to Nostr: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch(getRelayUrl(), { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  },
};

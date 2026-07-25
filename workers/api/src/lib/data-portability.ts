/**
 * @degenfeed/api-worker — Data Portability Standards
 *
 * Implements cross-platform data portability for DegenFeed users.
 * Supports ActivityPub, AT Protocol (Bluesky), Nostr, and Solid POD exports.
 *
 * "Your data, your rules, forever."
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────

export interface UserExportManifest {
  version: number;
  exportedAt: string;
  platform: 'degenfeed';
  user: {
    wallet: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
  };
  contents: {
    posts: number;
    replies: number;
    likes: number;
    reposts: number;
    media: number;
  };
  sections: string[];
  formats: string[];
}

export interface ActivityPubExport {
  '@context': string[];
  type: 'Person';
  id: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  icon?: { type: 'Image'; url: string };
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  published: string;
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}

export interface NostrExportEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey?: string;
}

export interface AtProtoExport {
  did: string;
  handle: string;
  posts: Array<{
    uri: string;
    cid: string;
    record: Record<string, unknown>;
    indexedAt: string;
  }>;
  follows: Array<{
    did: string;
    handle?: string;
  }>;
  likes: Array<{
    uri: string;
    cid: string;
    createdAt: string;
  }>;
  profile?: Record<string, unknown>;
}

export interface SolidPodExport {
  '@context': string;
  id: string;
  type: string[];
  updated: string;
  resources: Array<{
    id: string;
    type: string;
    storage: string;
    modified: string;
    size: number;
  }>;
}

export interface DataTransferProjectPackage {
  fileFormat: string;
  dataType: string;
  exportDate: string;
  source: string;
  contents: Record<string, unknown>;
}

// ─── Exported Functions ────────────────────────────────────────────────

/**
 * Build a UserExportManifest describing what data is available for export.
 */
export function buildExportManifest(
  wallet: string,
  stats: { posts: number; replies: number; likes: number; reposts: number; media: number },
  profile?: { displayName?: string; avatarUrl?: string; bio?: string },
): UserExportManifest {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: 'degenfeed',
    user: {
      wallet,
      displayName: profile?.displayName,
      avatarUrl: profile?.avatarUrl,
      bio: profile?.bio,
    },
    contents: stats,
    sections: [
      'profile',
      'posts',
      'replies',
      'likes',
      'reposts',
      'media',
      'follows',
      'followers',
      'subscriptions',
      'tips',
      'dao_memberships',
      'dao_votes',
      'creator_coins',
      'identity_links',
      'preferences',
      'activity_log',
      'connected_apps',
    ],
    formats: ['json', 'csv', 'html', 'activitypub'],
  };
}

/**
 * Export user data in ActivityPub Actor format (compatible with Mastodon/Pleroma).
 */
export function buildActivityPubProfile(
  wallet: string,
  handle: string,
  profile?: { displayName?: string; summary?: string; avatarUrl?: string },
  publicKeyPem?: string,
): ActivityPubExport {
  const baseId = `https://degenfeed.xyz/users/${handle}`;
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    type: 'Person',
    id: baseId,
    preferredUsername: handle,
    name: profile?.displayName,
    summary: profile?.summary,
    icon: profile?.avatarUrl
      ? { type: 'Image', url: profile.avatarUrl }
      : undefined,
    inbox: `${baseId}/inbox`,
    outbox: `${baseId}/outbox`,
    followers: `${baseId}/followers`,
    following: `${baseId}/following`,
    published: new Date().toISOString(),
    publicKey: {
      id: `${baseId}#main-key`,
      owner: baseId,
      publicKeyPem: publicKeyPem || '',
    },
  };
}

/**
 * Build ActivityPub Note objects from DegenFeed posts.
 * These can be imported into Mastodon, Pleroma, or Lemmy.
 */
export function buildActivityPubNotes(
  posts: Array<{
    id: string;
    body: string;
    createdAt: number;
    media?: Array<{ url: string; mimeType: string; alt?: string }>;
    tags?: string[];
    replyTo?: string;
  }>,
  actorId: string,
): Array<Record<string, unknown>> {
  return posts.map((post) => {
    const note: Record<string, unknown> = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: post.replyTo ? 'Note' : 'Note',
      id: `${actorId}/posts/${post.id}`,
      attributedTo: actorId,
      content: post.body,
      published: new Date(post.createdAt).toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actorId}/followers`],
    };

    if (post.media && post.media.length > 0) {
      note.attachment = post.media.map((m) => ({
        type: 'Document',
        mediaType: m.mimeType,
        url: m.url,
        name: m.alt || '',
      }));
    }

    if (post.tags && post.tags.length > 0) {
      note.tag = post.tags.map((t) => ({
        type: 'Hashtag',
        href: `https://degenfeed.xyz/tags/${t}`,
        name: `#${t}`,
      }));
    }

    if (post.replyTo) {
      note.inReplyTo = post.replyTo;
    }

    return note;
  });
}

/**
 * Export user data in Nostr format (kind 0 metadata + kind 3 follow list).
 */
export function buildNostrExport(
  profile?: { displayName?: string; about?: string; picture?: string; nip05?: string },
  followPubkeys?: string[],
): NostrExportEvent[] {
  const events: NostrExportEvent[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Kind 0: Metadata
  if (profile) {
    const metadata: Record<string, string> = {};
    if (profile.displayName) metadata.name = profile.displayName;
    if (profile.about) metadata.about = profile.about;
    if (profile.picture) metadata.picture = profile.picture;
    if (profile.nip05) metadata.nip05 = profile.nip05;
    events.push({
      kind: 0,
      content: JSON.stringify(metadata),
      tags: [],
      created_at: now,
    });
  }

  // Kind 3: Follow list
  if (followPubkeys && followPubkeys.length > 0) {
    events.push({
      kind: 3,
      content: '',
      tags: followPubkeys.map((pk) => ['p', pk, 'wss://relay.damus.io']),
      created_at: now,
    });
  }

  return events;
}

/**
 * Export posts as Nostr kind 1 events.
 */
export function buildNostrNotes(
  posts: Array<{
    id: string;
    body: string;
    createdAt: number;
    tags?: string[];
    replyTo?: string;
  }>,
): NostrExportEvent[] {
  return posts.map((post) => {
    const tags: string[][] = [];
    if (post.tags) {
      for (const tag of post.tags) {
        tags.push(['t', tag]);
      }
    }
    if (post.replyTo) {
      tags.push(['e', post.replyTo, '', 'reply']);
    }
    tags.push(['client', 'degenfeed']);
    tags.push(['L', 'degenfeed.xyz']);

    return {
      kind: 1,
      content: post.body,
      tags,
      created_at: Math.floor(post.createdAt / 1000),
    };
  });
}

/**
 * Build AT Protocol (Bluesky) compatible export.
 * Returns structured data formatted for bluesky import.
 */
export function buildAtProtoExport(
  did: string,
  handle: string,
  data: {
    posts?: Array<{
      cid: string;
      text: string;
      createdAt: string;
      replyTo?: { uri: string; cid: string };
      embed?: Record<string, unknown>;
    }>;
    follows?: Array<{ did: string; handle?: string }>;
    likes?: Array<{ uri: string; cid: string; createdAt: string }>;
    profile?: Record<string, unknown>;
  },
): AtProtoExport {
  return {
    did,
    handle,
    posts: (data.posts || []).map((p) => ({
      uri: `at://${did}/app.bsky.feed.post/${p.cid}`,
      cid: p.cid,
      record: {
        $type: 'app.bsky.feed.post',
        text: p.text,
        createdAt: p.createdAt,
        ...(p.replyTo ? { reply: { parent: p.replyTo, root: p.replyTo } } : {}),
        ...(p.embed ? { embed: p.embed } : {}),
      },
      indexedAt: p.createdAt,
    })),
    follows: data.follows || [],
    likes: data.likes || [],
    profile: data.profile,
  };
}

/**
 * Build a Solid POD compatible export for true data ownership.
 * Solid PODs give users control over where their data lives.
 */
export function buildSolidPodExport(
  wallet: string,
  resources: Array<{
    id: string;
    type: string;
    size: number;
  }>,
): SolidPodExport {
  const now = new Date().toISOString();
  return {
    '@context': 'http://www.w3.org/ns/solid/terms#',
    id: `https://solid.degenfeed.xyz/${wallet}/`,
    type: ['SolidPod', 'Storage'],
    updated: now,
    resources: resources.map((r) => ({
      id: `https://solid.degenfeed.xyz/${wallet}/${r.id}`,
      type: r.type,
      storage: `https://solid.degenfeed.xyz/${wallet}/`,
      modified: now,
      size: r.size,
    })),
  };
}

/**
 * Build a Data Transfer Project (DTP) compatible package.
 * This format is used by Google Takeout, Microsoft, and Facebook's
 * Data Transfer Project for portability between major platforms.
 */
export function buildDataTransferPackage(
  dataType: string,
  contents: Record<string, unknown>,
): DataTransferProjectPackage {
  return {
    fileFormat: 'json',
    dataType,
    exportDate: new Date().toISOString(),
    source: 'degenfeed',
    contents,
  };
}

/**
 * Convert a JSON export to CSV format for spreadsheet-friendly analytics.
 * Handles flat objects and arrays of objects.
 */
export function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      headers.add(key);
    }
  }

  const headerArray = Array.from(headers);
  const lines: string[] = [headerArray.join(',')];

  for (const row of data) {
    const values = headerArray.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Build a browsable HTML archive from user data sections.
 */
export function buildHtmlArchive(
  wallet: string,
  sections: Array<{ title: string; content: string }>,
): string {
  const sectionHtml = sections
    .map(
      (s) => `
    <section>
      <h2>${escapeHtml(s.title)}</h2>
      <div class="content">${escapeHtml(s.content)}</div>
    </section>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DegenFeed Data Export — ${escapeHtml(wallet.slice(0, 10))}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #00ff41; border-bottom: 1px solid #333; padding-bottom: 10px; }
    h2 { color: #00cc33; margin-top: 30px; }
    .content { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    section { margin-bottom: 30px; padding: 15px; background: #111; border-radius: 8px; border: 1px solid #222; }
    .meta { color: #888; font-size: 12px; margin-top: 40px; text-align: center; }
  </style>
</head>
<body>
  <h1>DegenFeed Data Export</h1>
  <p class="meta">Wallet: ${escapeHtml(wallet)} | Exported: ${new Date().toISOString()}</p>
  ${sectionHtml}
  <div class="meta">
    <p>This is an export of your data from DegenFeed. You own this data.</p>
    <p>Generated by DegenFeed Data Portability System</p>
  </div>
</body>
</html>`;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Enhanced Portability Builders (v2) ──────────────────────────

/**
 * Build a Mastodon-compatible CSV import file from posts.
 * Mastodon accepts CSV with columns: status, media_ids, visibility, scheduled_at.
 */
export function buildMastodonCsvImport(
  posts: Array<{
    body: string;
    createdAt: number;
    mediaUrls?: string[];
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  }>,
): string {
  const header = 'id,status,created_at,visibility,media_attachments';
  const rows = posts.map((p, i) => {
    const escaped = p.body.replace(/"/g, '""');
    const createdAt = new Date(p.createdAt).toISOString();
    const visibility = p.visibility || 'public';
    const media = p.mediaUrls?.join(';') || '';
    return `${i + 1},"${escaped}",${createdAt},${visibility},"${media}"`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Build a Nostr-compatible bulk import (NDJSON of kind 1 events).
 * Events are unsigned — the importing client must sign them with the user's nsec.
 */
export function buildNostrBulkImport(
  posts: Array<{
    id: string;
    body: string;
    createdAt: number;
    tags?: string[];
    replyTo?: string;
  }>,
  pubkey?: string,
): string {
  return posts
    .map((post) => {
      const tags: string[][] = [];
      if (post.tags) {
        for (const tag of post.tags) {
          tags.push(['t', tag]);
        }
      }
      if (post.replyTo) {
        tags.push(['e', post.replyTo, '', 'reply']);
      }
      tags.push(['client', 'degenfeed']);
      tags.push(['L', 'degenfeed.xyz']);

      const event = {
        kind: 1,
        content: post.body,
        tags,
        created_at: Math.floor(post.createdAt / 1000),
        ...(pubkey ? { pubkey } : {}),
      };
      return JSON.stringify(event);
    })
    .join('\n');
}

/**
 * Build a Twitter-compatible archive manifest (JSON).
 * Twitter archive format: data/tweet.js style array.
 */
export function buildTwitterArchiveImport(
  posts: Array<{
    id: string;
    body: string;
    createdAt: number;
    tags?: string[];
  }>,
): string {
  const tweets = posts.map((p) => ({
    tweet: {
      id: p.id,
      full_text: p.body,
      created_at: new Date(p.createdAt).toISOString(),
      entities: {
        hashtags: (p.tags || []).map((t) => ({ text: t })),
      },
    },
  }));

  return JSON.stringify(
    {
      archive: tweets,
      exportedAt: new Date().toISOString(),
      source: 'degenfeed',
      total: tweets.length,
    },
    null,
    2,
  );
}

/**
 * Build a Bluesky/AT Protocol compatible CAR-style JSON export.
 * Structure mirrors com.atproto.sync.getRepo output.
 */
export function buildBlueskyRepoExport(
  did: string,
  handle: string,
  posts: Array<{
    id: string;
    body: string;
    createdAt: number;
  }>,
): string {
  const repo = {
    did,
    handle,
    collections: {
      'app.bsky.feed.post': posts.map((p) => ({
        $type: 'app.bsky.feed.post',
        cid: p.id,
        record: {
          text: p.body,
          createdAt: new Date(p.createdAt).toISOString(),
        },
      })),
    },
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(repo, null, 2);
}

/**
 * Build a Farcaster-compatible bulk import format.
 * Uses the standard Farcaster cast data structure.
 */
export function buildFarcasterBulkImport(
  casts: Array<{
    id: string;
    body: string;
    createdAt: number;
    tags?: string[];
  }>,
  fid?: number,
): string {
  const fcData = {
    fid,
    casts: casts.map((c) => ({
      hash: c.id,
      text: c.body,
      timestamp: Math.floor(c.createdAt / 1000),
      embeds: [],
      mentions: [],
      tags: c.tags || [],
    })),
    exportedAt: new Date().toISOString(),
    source: 'degenfeed',
  };
  return JSON.stringify(fcData, null, 2);
}

/**
 * Build a complete migration summary manifest.
 * Lists what was migrated, when, and to where.
 */
export function buildMigrationManifest(
  wallet: string,
  source: string,
  destination: string,
  stats: {
    totalItems: number;
    succeeded: number;
    failed: number;
  },
  durationMs: number,
): string {
  const manifest = {
    version: 1,
    migrationId: `migrate-${Date.now().toString(36)}`,
    wallet,
    source,
    destination,
    stats,
    duration: `${(durationMs / 1000).toFixed(1)}s`,
    completedAt: new Date().toISOString(),
    note: 'This migration manifest certifies the transfer of data between platforms. Retain for your records.',
  };
  return JSON.stringify(manifest, null, 2);
}

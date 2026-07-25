/**
 * @degenfeed/api-worker — Podcast RSS Feed Generator
 *
 * Generates iTunes-compatible RSS feeds for each podcast.
 * Fed via Castopod to ActivityPub followers.
 *
 * Supports:
 *   - iTunes podcast RSS 2.0
 *   - Episode metadata (title, description, duration, publish date)
 *   - Audio enclosure links with MIME types
 *   - Chapter markers (Podcast Namespace)
 *   - Cover art via iTunes image tag
 *   - ActivityPub outbox link for federation
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface PodcastFeedMeta {
  id: string;
  title: string;
  description: string;
  feedUrl: string;
  link: string;
  language: string;
  copyright?: string;
  author: string;
  ownerName: string;
  ownerEmail: string;
  imageUrl?: string;
  category?: string;
  subCategory?: string;
  explicit: boolean;
  keywords?: string[];
  activityPubId?: string;
  fundingUrl?: string;
}

export interface EpisodeEnclosure {
  url: string;
  length: number;
  type: string;
}

export interface ChapterMarker {
  startTime: number; // seconds
  title: string;
  imageUrl?: string;
  url?: string;
}

export interface PodcastEpisodeEntry {
  id: string;
  title: string;
  description: string;
  htmlDescription?: string;
  link?: string;
  guid: string;
  pubDate: string; // RFC 2822
  enclosure: EpisodeEnclosure;
  duration: number; // seconds
  episodeNumber?: number;
  seasonNumber?: number;
  explicit: boolean;
  imageUrl?: string;
  chapters?: ChapterMarker[];
  activityPubId?: string;
  transcriptUrl?: string;
}

// ─── Generator ─────────────────────────────────────────────────────────

/**
 * Build a complete iTunes-compatible podcast RSS 2.0 feed.
 */
export function generatePodcastRss(
  meta: PodcastFeedMeta,
  episodes: PodcastEpisodeEntry[],
): string {
  const now = new Date().toUTCString();
  const itunesNs = 'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"';
  const podcastNs = 'xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md"';
  const contentNs = 'xmlns:content="http://purl.org/rss/1.0/modules/content/"';
  const apNs = 'xmlns:activitypub="https://www.w3.org/ns/activitystreams#"';

  const channel = [
    `<title><![CDATA[${escapeCdata(meta.title)}]]></title>`,
    `<link>${escapeXml(meta.link)}</link>`,
    `<description><![CDATA[${escapeCdata(meta.description)}]]></description>`,
    `<language>${escapeXml(meta.language)}</language>`,
    `<lastBuildDate>${now}</lastBuildDate>`,
    `<pubDate>${now}</pubDate>`,
    `<generator>DegenFeed Podcast Engine v1.0</generator>`,
    `<ttl>60</ttl>`,
    // iTunes namespace
    `<itunes:author><![CDATA[${escapeCdata(meta.author)}]]></itunes:author>`,
    `<itunes:summary><![CDATA[${escapeCdata(meta.description)}]]></itunes:summary>`,
    `<itunes:subtitle><![CDATA[${escapeCdata(meta.description.slice(0, 200))}]]></itunes:subtitle>`,
    `<itunes:owner>`,
    `  <itunes:name><![CDATA[${escapeCdata(meta.ownerName)}]]></itunes:name>`,
    `  <itunes:email>${escapeXml(meta.ownerEmail)}</itunes:email>`,
    `</itunes:owner>`,
    `<itunes:explicit>${meta.explicit ? 'true' : 'false'}</itunes:explicit>`,
  ];

  // Category
  if (meta.category) {
    channel.push(
      meta.subCategory
        ? `<itunes:category text="${escapeXml(meta.category)}"><itunes:category text="${escapeXml(meta.subCategory)}"/></itunes:category>`
        : `<itunes:category text="${escapeXml(meta.category)}"/>`,
    );
  } else {
    channel.push(`<itunes:category text="Technology"/>`);
  }

  // Image
  if (meta.imageUrl) {
    channel.push(
      `<itunes:image href="${escapeXml(meta.imageUrl)}"/>`,
      `<image><url>${escapeXml(meta.imageUrl)}</url><title><![CDATA[${escapeCdata(meta.title)}]]></title><link>${escapeXml(meta.link)}</link></image>`,
    );
  }

  // Keywords
  if (meta.keywords && meta.keywords.length > 0) {
    channel.push(`<itunes:keywords>${escapeXml(meta.keywords.join(','))}</itunes:keywords>`);
  }

  // Funding / ActivityPub
  if (meta.fundingUrl) {
    channel.push(`<podcast:funding url="${escapeXml(meta.fundingUrl)}"><![CDATA[Support the show]]></podcast:funding>`);
  }
  if (meta.activityPubId) {
    channel.push(`<activitypub:actor>${escapeXml(meta.activityPubId)}</activitypub:actor>`);
  }

  // Episodes
  const items = episodes.map((ep) => generateEpisodeItem(ep));

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" ${itunesNs} ${podcastNs} ${contentNs} ${apNs}>`,
    `  <channel>`,
    ...channel.map((l) => `    ${l}`),
    ``,
    ...items,
    `  </channel>`,
    `</rss>`,
  ].join('\n');

  return xml;
}

/**
 * Generate a single <item> block for a podcast episode.
 */
function generateEpisodeItem(ep: PodcastEpisodeEntry): string {
  const lines: string[] = [];
  lines.push(`    <item>`);

  // Title
  lines.push(`      <title><![CDATA[${escapeCdata(ep.title)}]]></title>`);

  // Description (plain text iTunes summary + HTML content-encoded)
  lines.push(`      <itunes:summary><![CDATA[${escapeCdata(ep.description)}]]></itunes:summary>`);
  if (ep.htmlDescription) {
    lines.push(`      <content:encoded><![CDATA[${ep.htmlDescription}]]></content:encoded>`);
  } else {
    lines.push(`      <description><![CDATA[${escapeCdata(ep.description)}]]></description>`);
  }

  // Link
  if (ep.link) {
    lines.push(`      <link>${escapeXml(ep.link)}</link>`);
  }

  // GUID
  lines.push(`      <guid isPermaLink="${ep.link ? 'true' : 'false'}">${escapeXml(ep.guid)}</guid>`);

  // Publication date (RFC 2822)
  lines.push(`      <pubDate>${ep.pubDate}</pubDate>`);

  // Audio enclosure
  lines.push(
    `      <enclosure url="${escapeXml(ep.enclosure.url)}" length="${ep.enclosure.length}" type="${escapeXml(ep.enclosure.type)}"/>`,
  );

  // iTunes-specific episode fields
  lines.push(`      <itunes:duration>${formatDuration(ep.duration)}</itunes:duration>`);
  lines.push(`      <itunes:explicit>${ep.explicit ? 'true' : 'false'}</itunes:explicit>`);

  if (ep.episodeNumber !== undefined) {
    lines.push(`      <itunes:episode>${ep.episodeNumber}</itunes:episode>`);
  }
  if (ep.seasonNumber !== undefined) {
    lines.push(`      <itunes:season>${ep.seasonNumber}</itunes:season>`);
  }
  if (ep.imageUrl) {
    lines.push(`      <itunes:image href="${escapeXml(ep.imageUrl)}"/>`);
  }

  // Episode-specific activitypub ID
  if (ep.activityPubId) {
    lines.push(`      <activitypub:id>${escapeXml(ep.activityPubId)}</activitypub:id>`);
  }

  // Chapter markers (Podcast Namespace 1.0)
  if (ep.chapters && ep.chapters.length > 0) {
    const chaptersJson = JSON.stringify(
      ep.chapters.map((ch) => ({
        startTime: ch.startTime,
        title: ch.title,
        ...(ch.imageUrl ? { imageUrl: ch.imageUrl } : {}),
        ...(ch.url ? { url: ch.url } : {}),
      })),
    );
    const chaptersBase64 = Buffer.from(chaptersJson).toString('base64');
    lines.push(`      <podcast:chapters url="${escapeXml(ep.link || ep.enclosure.url)}/chapters.json" type="application/json+chapters"/>`);
    lines.push(`      <podcast:chapters><![CDATA[${chaptersBase64}]]></podcast:chapters>`);
  }

  // Transcript
  if (ep.transcriptUrl) {
    lines.push(`      <podcast:transcript url="${escapeXml(ep.transcriptUrl)}" type="text/html"/>`);
  }

  lines.push(`    </item>`);
  return lines.join('\n');
}

// ─── Utility ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCdata(str: string): string {
  // CDATA cannot contain ]]> — replace with unicode escape equivalent
  return str.replace(/\]\]>/g, ']]&gt;');
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Generate a chapters JSON file URL for an episode.
 */
export function chapterFileUrl(feedUrl: string, episodeGuid: string): string {
  return `${feedUrl.replace(/\/feed$/, '')}/episodes/${encodeURIComponent(episodeGuid)}/chapters.json`;
}

/**
 * Generate an OPML subscription file for a list of podcast feeds.
 */
export function generateOpml(feeds: Array<{ title: string; feedUrl: string; imageUrl?: string }>): string {
  const outlines = feeds
    .map(
      (f) =>
        `    <outline text="${escapeXml(f.title)}" type="rss" xmlUrl="${escapeXml(f.feedUrl)}"${f.imageUrl ? ` imageUrl="${escapeXml(f.imageUrl)}"` : ''}/>`,
    )
    .join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<opml version="2.0">`,
    `  <head>`,
    `    <title>DegenFeed Podcast Subscriptions</title>`,
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    `  </head>`,
    `  <body>`,
    outlines,
    `  </body>`,
    `</opml>`,
  ].join('\n');
}

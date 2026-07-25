/**
 * @degenfeed/cross-protocol-bridge — Nostr Content Adapter
 *
 * Adapts a MasterPost into a Nostr kind 1 note or NIP-23 long-form article.
 * - Short text (< 500 chars) → kind 1
 * - Long text or when title is present → kind 30023 (NIP-23 long-form)
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

export const nostrAdapter: PlatformAdapter = {
  protocol: 'nostr',
  name: 'Nostr',
  charLimit: 50_000,
  maxMedia: 10,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'bare');
    let content = master.text;

    // Append mentions as npub-style references (adapter hints)
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      content += `\n\n${mentions.map((m) => `nostr:${m}`).join(' ')}`;
    }

    // Append hashtags
    if (hashtags.length > 0) {
      content += `\n\n${hashtags.map((h) => `#${h}`).join(' ')}`;
    }

    // Truncate if needed
    content = truncateText(content, this.charLimit);

    // Build extra: tags for NIP-23 if title present
    const extra: Record<string, unknown> = {};

    // Determine kind: 1 for short notes, 30023 for long-form
    const isLongForm = !!master.title || master.text.length > 1000;
    extra.kind = isLongForm ? 30023 : 1;
    extra.tags = hashtags.map((h) => ['t', h]);

    if (isLongForm && master.title) {
      extra.title = master.title;
      extra.summary = master.text.slice(0, 200);
    }

    // Link card handling
    if (master.linkCard) {
      extra.linkCard = master.linkCard;
      extra.tags = [...(extra.tags as string[][]), ['r', master.linkCard.url]];
    }

    return {
      protocol: 'nostr',
      text: content,
      title: isLongForm ? master.title : undefined,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      formattedHashtags: hashtags.map((h) => `#${h}`),
      formattedMentions: mentions,
      extra,
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    const isLongForm = !!master.title || master.text.length > 1000;
    const kind = isLongForm ? 30023 : 1;
    let preview = `[Nostr — Kind ${kind}]`;

    if (isLongForm && master.title) {
      preview += `\n📄 ${master.title}`;
    }

    preview += `\n${master.text.slice(0, 300)}${master.text.length > 300 ? '...' : ''}`;

    if (master.hashtags && master.hashtags.length > 0) {
      preview += `\n🏷️ ${master.hashtags.map((h) => `#${h}`).join(' ')}`;
    }

    if (master.linkCard) {
      preview += `\n🔗 ${master.linkCard.url}`;
    }

    return preview;
  },
};

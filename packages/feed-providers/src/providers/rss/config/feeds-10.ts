import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_10: RssFeedConfig[] = [
  cfg('https://www.reddit.com/r/interestingasfuck/.rss?limit=100', {
    tier: 5,
    weight: 0.5,
    category: 'social',
    tags: ['general', 'interesting'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/todayilearned/.rss?limit=100', {
    tier: 5,
    weight: 0.5,
    category: 'social',
    tags: ['general', 'education'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/dataisbeautiful/.rss?limit=100', {
    tier: 5,
    weight: 0.5,
    category: 'social',
    tags: ['data', 'visualization'],
    authority: 1,
  }),
  // ── Extra expansion subs ──
  cfg('https://www.reddit.com/r/ethereumdev/.rss?limit=100', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ethereum', 'dev'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/software/.rss?limit=100', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['software'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/compsci/.rss?limit=100', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['cs', 'science'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Mastodon / Fediverse / Social
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://social.degenfeed.xyz/@admin.rss', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['crypto', 'fediverse'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Lemmy — Federated Communities
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://lemmy.world/feeds/c/cryptocurrency.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://lemmy.ml/feeds/c/bitcoin.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/technology.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['tech'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/ai.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ai'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/defi.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['defi'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/blockchain.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['blockchain'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/web3.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['web3'],
    authority: 1,
  }),
  cfg('https://lemmy.ml/feeds/c/ethereum.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ethereum'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/solana.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['solana'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/cybersecurity.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['security'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // PeerTube — Federated Video
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://tilvids.com/feeds/videos.xml', {
    tier: 5,
    weight: 0.6,
    category: 'video',
    tags: ['tech', 'education'],
    authority: 1,
  }),
  cfg('https://video.ploud.fr/feeds/videos.xml?sort=-publishedAt', {
    tier: 5,
    weight: 0.6,
    category: 'video',
    tags: ['tech', 'video'],
    authority: 1,
  }),
  // cryptoconomy.com & diode.zone PeerTube removed — timeout

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Substack (weight: 1.0, tier: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://pomp.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'macro'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://panteracapital.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'blockchain'],
    authority: 3,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://unchainedcrypto.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'interviews'],
    authority: 3,
    isPaid: false,
    schedule: 'weekly',
  }),
];

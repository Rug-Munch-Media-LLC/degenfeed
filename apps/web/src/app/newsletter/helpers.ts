import type { NewsletterEntry } from './types';

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function protocolEmoji(p: string): string {
  const map: Record<string, string> = {
    nostr: '⚡',
    farcaster: '🟣',
    lens: '🌿',
    bluesky: '🦋',
    mastodon: '🐘',
    threads: '🧵 (experimental)',
    rss: '📡',
  };
  return map[p] ?? '●';
}

export function computeNewTodayStats(
  allNewsletters: NewsletterEntry[],
  _newslettersByTopic: Record<string, NewsletterEntry[]>,
): { categoryCounts: Record<string, number>; totalDaily: number } {
  const daily = allNewsletters.filter((n) => n.schedule === 'daily');
  const categoryCounts: Record<string, number> = {
    crypto: daily.filter((n) =>
      [
        'CoinTelegraph Newsletter',
        'CoinDesk Newsletter',
        'The Block Newsletter',
        'Blockworks Daily',
        'Bankless',
        'Milk Road',
        'Token Dispatch',
        'Messari Daily',
        'The Scoop',
        'Empire',
        'The Tie',
        'Crypto Briefing',
        'BeInCrypto',
        '24/7 Crypto',
        'Pomp Letter',
      ].includes(n.name),
    ).length,
    tech: daily.filter((n) =>
      [
        'TLDR Tech',
        'The Hustle',
        'Stratechery',
        'The Verge Newsletter',
        'Ars Technica Newsletter',
        'Wired Newsletter',
        'TechCrunch Daily',
      ].includes(n.name),
    ).length,
    ai: daily.filter((n) => ['The Neuron', "Ben's Bites", 'AI Tool Report'].includes(n.name))
      .length,
    defi: daily.filter((n) =>
      ['The Daily Gwei', 'DeFi Times', 'The Defiant', 'Proof of Work', 'The Drop'].includes(n.name),
    ).length,
  };
  return { categoryCounts, totalDaily: daily.length };
}

export function getCategoryStats(
  newsletterCategories: Array<{ id: string; label: string; color: string; icon: string }>,
  newslettersByTopic: Record<string, NewsletterEntry[]>,
) {
  return newsletterCategories.map((cat) => {
    let count = 0;
    switch (cat.id) {
      case 'crypto':
        count = newslettersByTopic.crypto?.length ?? 0;
        break;
      case 'tech':
        count = newslettersByTopic.tech?.length ?? 0;
        break;
      case 'ai':
        count = newslettersByTopic.ai?.length ?? 0;
        break;
      case 'defi':
        count = newslettersByTopic.defi?.length ?? 0;
        break;
      case 'nft':
        count = 2;
        break;
      case 'regulation':
        count = 3;
        break;
      case 'macro':
        count = 5;
        break;
      case 'startups':
        count = newslettersByTopic.startups?.length ?? 0;
        break;
      case 'science':
        count = newslettersByTopic.science?.length ?? 0;
        break;
      default:
        count = 0;
    }
    return { ...cat, count };
  });
}

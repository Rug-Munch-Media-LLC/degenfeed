'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface DiscoverAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  note: string;
  followers_count: number;
  instance: string;
}

const INSTANCES = [
  { url: 'https://bitcoinhackers.org', label: 'Bitcoin Hackers', topic: 'Bitcoin' },
  { url: 'https://fosstodon.org', label: 'Fosstodon', topic: 'FOSS/Tech' },
  { url: 'https://hachyderm.io', label: 'Hachyderm', topic: 'Tech' },
  { url: 'https://infosec.exchange', label: 'Infosec Exchange', topic: 'InfoSec' },
  { url: 'https://cryptodon.lol', label: 'Cryptodon', topic: 'Crypto' },
];

async function fetchMastodonAPI(url: string): Promise<DiscoverAccount[] | null> {
  try {
    const res = await fetch(`/api/discover?instance=${encodeURIComponent(url)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DiscoverAccount[];
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export default function DiscoverPage() {
  const [accounts, setAccounts] = useState<Record<string, DiscoverAccount[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results: Record<string, DiscoverAccount[]> = {};
      const reqs = INSTANCES.map(async (inst) => {
        const data = await fetchMastodonAPI(inst.url);
        if (data && !cancelled) results[inst.url] = data;
      });
      await Promise.allSettled(reqs);
      if (!cancelled) {
        setAccounts(results);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 text-center">
          <Image
            src="/icon.svg"
            alt="DegenFeed"
            width={60}
            height={60}
            className="mx-auto mb-3 h-14 w-14 rounded-xl shadow-[0_0_20px_rgba(0,255,65,0.3)]"
          />
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Fediverse Discovery</h1>
          <p className="mt-2 text-sm text-gray-400">
            Popular accounts from crypto, tech, and infosec Mastodon instances.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-20" />
            ))}
          </div>
        ) : (
          INSTANCES.map((inst) => {
            const items = accounts[inst.url];
            if (!items || items.length === 0) return null;
            return (
              <div key={inst.url} className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-degen-500/10 px-2.5 py-0.5 text-xs font-medium text-degen-400">
                    {inst.topic}
                  </span>
                  <h2 className="text-sm font-semibold text-[var(--color-fg)]">{inst.label}</h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.slice(0, 8).map((a) => (
                    <a
                      key={a.id}
                      href={`https://${new URL(inst.url).hostname}/@${a.acct}`}
                      target="_blank"
                      rel="noopener"
                      className="card flex items-center gap-3 transition-colors hover:border-degen-500/30"
                    >
                      <Image
                        src={a.avatar}
                        alt={a.display_name}
                        width={48}
                        height={48}
                        className="h-10 w-10 rounded-full bg-[var(--color-muted)] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {a.display_name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">@{a.acct}</div>
                        <div className="mt-1 text-xs text-gray-400 line-clamp-1">
                          {stripHtml(a.note)}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-gray-600">
                        {a.followers_count.toLocaleString()} followers
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ErrorBoundary>
  );
}

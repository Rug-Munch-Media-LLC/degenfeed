'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface AchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlockedAt: number | null;
}

interface AchievementsResponse {
  achievements: AchievementItem[];
  unlockedCount: number;
  totalCount: number;
  rarity: Record<string, number>;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'creation', label: 'Creation' },
  { id: 'social', label: 'Social' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'governance', label: 'Governance' },
  { id: 'milestone', label: 'Milestone' },
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AchievementsPage() {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gamification/achievements', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sign in to view achievements');
        throw new Error('Failed to load achievements');
      }
      const json = (await res.json()) as AchievementsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const filteredAchievements =
    data?.achievements.filter((a) => {
      if (activeCategory === 'all') return true;
      return a.category === activeCategory;
    }) ?? [];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--color-muted-bg)] rounded" />
          <div className="h-4 w-32 bg-[var(--color-muted-bg)] rounded" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 bg-[var(--color-muted-bg)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-2">Achievements</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">{error}</p>
        <Link href="/profile" className="text-degen-400 text-sm hover:text-degen-300">
          ← Back to Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">🏆 Achievements</h1>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Unlock achievements by exploring DegenFeed. Each one unlocks a badge on your profile.
            </p>
          </div>
          <Link href="/profile" className="text-xs text-degen-400 hover:text-degen-300">
            ← Profile
          </Link>
        </div>

        {/* Progress card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--color-fg)]">Progress</span>
            <span className="text-sm text-degen-400 font-bold">
              {data?.unlockedCount ?? 0}/{data?.totalCount ?? 12}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--color-muted-bg)] overflow-hidden">
            <div
              className="h-full rounded-full bg-degen-500 transition-all duration-700"
              style={{
                width: `${data ? Math.round((data.unlockedCount / data.totalCount) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            aria-pressed={activeCategory === cat.id}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
                : 'bg-[var(--color-muted-bg)] text-[var(--color-muted)] border border-transparent hover:border-[var(--color-border)]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredAchievements.map((achievement) => {
          const rarity = data?.rarity[achievement.id];
          return (
            <div
              key={achievement.id}
              className={`rounded-xl border p-4 transition-all ${
                achievement.unlocked
                  ? 'border-degen-500/30 bg-degen-500/5 shadow-sm shadow-degen-500/10'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{achievement.icon}</span>
                {achievement.unlocked && (
                  <span className="text-[10px] text-degen-400 font-medium">✓ Unlocked</span>
                )}
              </div>
              <h3
                className={`text-sm font-semibold mb-0.5 ${
                  achievement.unlocked ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'
                }`}
              >
                {achievement.title}
              </h3>
              <p className="text-[11px] text-[var(--color-muted)] mb-2">
                {achievement.description}
              </p>
              <div className="flex items-center justify-between">
                {achievement.unlocked && achievement.unlockedAt ? (
                  <span className="text-[10px] text-degen-400">
                    {formatDate(achievement.unlockedAt)}
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {rarity != null ? `${rarity}% of users have this` : '\u00A0'}
                  </span>
                )}
                {!achievement.unlocked && (
                  <span className="text-[10px] text-gray-500">🔒 Locked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--color-muted)]">No achievements in this category.</p>
        </div>
      )}
    </div>
  );
}

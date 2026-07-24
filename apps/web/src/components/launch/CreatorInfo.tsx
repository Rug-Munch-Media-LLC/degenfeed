'use client';

interface CreatorInfoProps {
  creator: {
    address: string;
    name: string;
    reputation: number;
    avatar?: string;
    socials?: Record<string, string>;
  };
  showSocials?: boolean;
  loading?: boolean;
  className?: string;
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function reputationColor(score: number): string {
  if (score >= 80) return 'text-degen-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function reputationBadge(score: number): string {
  if (score >= 80) return '🚀 Top Creator';
  if (score >= 50) return '👍 Trusted';
  if (score >= 20) return '⚠️ New';
  return '🛑 Caution';
}

export default function CreatorInfo({
  creator,
  showSocials = true,
  loading = false,
  className = '',
}: CreatorInfoProps) {
  // Loading state
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-gradient-to-br from-degen-500/20 to-purple-500/20">
          {creator.avatar ? (
            <img
              src={creator.avatar}
              alt={creator.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm font-bold text-degen-400">
              {creator.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
              {creator.name}
            </span>
            <span className="shrink-0 font-mono text-[9px] sm:text-[10px] text-[var(--color-muted)]">
              {shortenAddress(creator.address)}
            </span>
          </div>

          {/* Reputation */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill={star <= Math.round(creator.reputation / 20) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={reputationColor(creator.reputation)}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-semibold ${reputationColor(creator.reputation)}`}
              >
                {creator.reputation}/100
              </span>
            </div>
            <span className="rounded bg-[var(--color-accent-glow)] px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium text-degen-400">
              {reputationBadge(creator.reputation)}
            </span>
          </div>

          {/* Social links — scrollable on mobile */}
          {showSocials && creator.socials && Object.keys(creator.socials).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(creator.socials).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 sm:py-0.5 text-[9px] sm:text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400 touch-target"
                >
                  {platform === 'twitter' || platform === 'x'
                    ? '𝕏'
                    : platform === 'farcaster'
                      ? '◈'
                      : platform === 'nostr'
                        ? '☰'
                        : platform === 'bluesky'
                          ? '☁'
                          : platform === 'mastodon'
                            ? '🐘'
                            : platform === 'telegram'
                              ? '✈'
                              : platform === 'website'
                                ? '🌐'
                                : '🔗'}
                  <span className="hidden sm:inline">
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

export function FeedFilterBar({
  hideLowQuality,
  onToggleHideLowQuality,
  allowNonCrypto,
  onToggleAllowNonCrypto,
  showOriginalContent,
  onToggleShowOriginal,
  protocolFilter,
  onProtocolFilterChange,
  onOpenTuner,
}: {
  hideLowQuality: boolean;
  onToggleHideLowQuality: () => void;
  allowNonCrypto: boolean;
  onToggleAllowNonCrypto: () => void;
  showOriginalContent: boolean;
  onToggleShowOriginal: () => void;
  minEngagement: number;
  onMinEngagementChange: (v: number) => void;
  protocolFilter: string | null;
  onProtocolFilterChange: (v: string | null) => void;
  onOpenTuner: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={hideLowQuality}
          onChange={onToggleHideLowQuality}
          className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
        />
        <span className="text-[10px] text-[var(--color-muted)]">Hide low quality</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={allowNonCrypto}
          onChange={onToggleAllowNonCrypto}
          className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
        />
        <span className="text-[10px] text-[var(--color-muted)]">Allow non-crypto</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={showOriginalContent}
          onChange={onToggleShowOriginal}
          className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
        />
        <span className="text-[10px] text-[var(--color-muted)]">Original only</span>
      </label>
      <select
        value={protocolFilter || ''}
        onChange={(e) => onProtocolFilterChange(e.target.value || null)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[10px] text-[var(--color-fg)]"
      >
        <option value="">All protocols</option>
        <option value="nostr">Nostr</option>
        <option value="farcaster">Farcaster</option>
        <option value="lens">Lens</option>
        <option value="bluesky">Bluesky</option>
        <option value="mastodon">Mastodon</option>
      </select>
      <button
        type="button"
        onClick={onOpenTuner}
        className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]"
      >
        Tune Feed
      </button>
    </div>
  );
}

export function FeedTabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="mb-6 flex border-b border-[var(--color-border)]" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
          )}
        </button>
      ))}
    </div>
  );
}

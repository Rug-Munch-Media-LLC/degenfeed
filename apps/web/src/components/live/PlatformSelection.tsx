'use client';

export type LivePlatform = 'owncast' | 'peertube' | 'both';

interface Props { selected: LivePlatform; onChange: (p: LivePlatform) => void; }

const PLATFORMS: Array<{ id: LivePlatform; label: string; icon: string; description: string; features: string[]; color: string }> = [
  { id: 'owncast', label: 'Owncast', icon: '📡', description: 'Self-hosted on our Owncast instance', features: ['No censorship', 'Own your content', 'Embed anywhere', 'IRC chat'], color: '#00ff41' },
  { id: 'peertube', label: 'PeerTube', icon: '🎥', description: 'Federated via our PeerTube instance', features: ['ActivityPub fedi', 'VOD recording', 'Live chat', 'Cross-instance reach'], color: '#F1684B' },
  { id: 'both', label: 'Both (Simulcast)', icon: '🔀', description: 'Stream to Owncast + PeerTube simultaneously', features: ['Maximum reach', 'Unified chat', 'Cross-platform VOD', 'Federation + ownership'], color: '#FFD600' },
];

export function PlatformSelection({ selected, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Choose Your Platform</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Where do you want to stream?</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PLATFORMS.map((p) => {
          const isActive = selected === p.id;
          return (
            <button key={p.id} type="button" onClick={() => onChange(p.id)}
              className={`group relative cursor-pointer rounded-xl border p-4 text-left transition-all ${
                isActive ? 'border-degen-500/50 bg-degen-500/10 shadow-[0_0_16px_var(--color-accent-glow)]' : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-white/20'
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div><div className={`text-base font-bold ${isActive ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}>{p.label}</div><div className="text-[10px] text-[var(--color-muted)]">{p.description}</div></div>
              </div>
              <div className="mt-3 space-y-1">{p.features.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
                  <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: p.color }} />{f}
                </div>
              ))}</div>
              {isActive && <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-degen-500"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

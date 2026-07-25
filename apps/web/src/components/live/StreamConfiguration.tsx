'use client';

import { useCallback, useRef } from 'react';
import type { StreamConfig } from './GoLiveFlow';
import type { LivePlatform } from './PlatformSelection';

interface Props { config: StreamConfig; onChange: (c: StreamConfig) => void; }

const CATEGORIES = [
  { id: 'gaming', label: 'Gaming', icon: '🎮' }, { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '🪙' }, { id: 'art', label: 'Art & Creative', icon: '🎨' },
  { id: 'irl', label: 'IRL & Lifestyle', icon: '🌍' }, { id: 'talk', label: 'Talk Shows & Podcasts', icon: '🎙️' },
  { id: 'education', label: 'Education', icon: '📚' }, { id: 'tech', label: 'Tech & Coding', icon: '💻' },
  { id: 'sports', label: 'Sports', icon: '⚽' }, { id: 'trading', label: 'Trading', icon: '📈' },
];
const TAGS_PRESETS = ['live', 'stream', 'crypto', 'web3', 'defi', 'nft', 'gaming', 'music', 'tech', 'education'];

export function StreamConfiguration({ config, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const update = useCallback((partial: Partial<StreamConfig>) => onChange({ ...config, ...partial }), [config, onChange]);
  const handleThumbnail = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (ev) => update({ thumbnail: file, thumbnailPreview: ev.target?.result as string }); reader.readAsDataURL(file);
  }, [update]);
  const toggleTag = useCallback((tag: string) => { update({ tags: config.tags.includes(tag) ? config.tags.filter((t) => t !== tag) : [...config.tags, tag] }); }, [config, update]);

  return (
    <div className="space-y-5">
      <div className="text-center"><h3 className="text-lg font-bold text-[var(--color-fg)]">Stream Configuration</h3><p className="mt-1 text-sm text-[var(--color-muted)]">Set up your stream details</p></div>
      <div><label htmlFor="live-title" className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Stream Title</label><input id="live-title" type="text" value={config.title} onChange={(e) => update({ title: e.target.value })} placeholder="What's your stream about?" maxLength={120} required className="input w-full" /></div>
      <div><label htmlFor="live-desc" className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Description <span className="text-[var(--color-muted)]">(optional)</span></label><textarea id="live-desc" value={config.description} onChange={(e) => update({ description: e.target.value })} placeholder="Tell viewers what to expect..." maxLength={1000} rows={3} className="input w-full resize-none" /></div>
      <div><label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Category</label><div className="grid grid-cols-5 gap-1.5">{CATEGORIES.map((cat) => (<button key={cat.id} type="button" onClick={() => update({ category: cat.id })} className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-all ${config.category === cat.id ? 'border-degen-500/50 bg-degen-500/10 text-degen-400' : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}><span className="text-sm">{cat.icon}</span><span className="text-center leading-tight">{cat.label}</span></button>))}</div></div>
      <div><label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Tags <span className="text-[var(--color-muted)]">(click to toggle)</span></label><div className="flex flex-wrap gap-1.5">{TAGS_PRESETS.map((tag) => (<button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${config.tags.includes(tag) ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500/30' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>#{tag}</button>))}</div></div>
      <div><label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Thumbnail <span className="text-[var(--color-muted)]">(optional)</span></label><div className="flex items-center gap-3"><button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-16 w-28 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-glass-border)] text-[10px] text-[var(--color-muted)] transition-colors hover:border-degen-500/30">{config.thumbnailPreview ? <img src={config.thumbnailPreview} alt="Thumbnail preview" className="h-full w-full rounded-lg object-cover" /> : <div className="text-center"><div className="mb-1 text-lg">🖼️</div>Upload</div>}</button><input ref={fileInputRef} type="file" accept="image/*" onChange={handleThumbnail} className="hidden" /><div className="text-[10px] text-[var(--color-muted)]">Recommended: 1280×720px<br />Max 5MB</div></div></div>
      <div><label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Privacy</label><div className="flex gap-2">{(['public', 'unlisted', 'private'] as const).map((p) => (<button key={p} type="button" onClick={() => update({ privacy: p })} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${config.privacy === p ? 'border-degen-500/50 bg-degen-500/10 text-degen-400' : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'}`}>{p === 'public' && '🌐'} {p === 'unlisted' && '🔗'} {p === 'private' && '🔒'} {p}</button>))}</div></div>
      <div className="flex gap-4"><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={config.chatEnabled} onChange={(e) => update({ chatEnabled: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-white/5 accent-degen-500" /><span className="text-xs text-[var(--color-fg)]">Enable Chat</span></label><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={config.recordingEnabled} onChange={(e) => update({ recordingEnabled: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-white/5 accent-degen-500" /><span className="text-xs text-[var(--color-fg)]">Save VOD</span></label></div>
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';
import DropZone from './DropZone';
import PublishTargetPills from './PublishTargetPills';
import type { PublishTarget } from './types';
import { CATEGORIES } from './types';

export default function VideoTab() {
  const [mode, setMode] = useState<'upload' | 'metadata' | 'publishing' | 'done'>('upload');
  const [_file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'followers' | 'token-gated'>(
    'public',
  );
  const [publishTargets, setPublishTargets] = useState<Set<PublishTarget>>(
    new Set(['degenfeed', 'peertube']),
  );
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [tokenGated, setTokenGated] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [_error, setError] = useState<string | null>(null);

  const togglePublishTarget = useCallback((target: PublishTarget) => {
    setPublishTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }, []);

  const handleFile = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    setMode('metadata');
  }, []);

  const handleThumbnailUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) setThumbnail(URL.createObjectURL(f));
    };
    input.click();
  }, []);

  const handlePublish = useCallback(async () => {
    if (!title.trim()) return;
    setMode('publishing');
    setUploadProgress(0);
    for (let i = 0; i <= 100; i += 3) {
      await new Promise((r) => setTimeout(r, 30));
      setUploadProgress(i);
    }
    await new Promise((r) => setTimeout(r, 500));
    setMode('done');
  }, [title]);

  const handleReset = useCallback(() => {
    setMode('upload');
    setFile(null);
    setPreviewUrl(null);
    setTitle('');
    setDescription('');
    setTags('');
    setCategory('Entertainment');
    setVisibility('public');
    setPublishTargets(new Set(['degenfeed', 'peertube']));
    setThumbnail(null);
    setTipsEnabled(true);
    setTokenGated(false);
    setUploadProgress(0);
    setError(null);
  }, []);

  if (mode === 'upload') {
    return <DropZone onFile={handleFile} accept="video/*" label="Drop video here to upload" />;
  }

  if (mode === 'metadata' && previewUrl) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <video
            src={previewUrl}
            controls
            className="w-full rounded-2xl max-h-[300px] object-contain bg-black"
          >
            <track kind="captions" />
          </video>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleThumbnailUpload}
              className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              {thumbnail ? 'Change Thumbnail' : 'Add Thumbnail'}
            </button>
            {thumbnail && (
              <img src={thumbnail} alt="Thumbnail" className="h-10 w-16 rounded-lg object-cover" />
            )}
          </div>
        </div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              htmlFor="field-01017dcf"
            >
              Title
            </label>
            <input
              id="field-01017dcf"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title..."
              maxLength={200}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              htmlFor="field-dfc108ec"
            >
              Description
            </label>
            <textarea
              id="field-dfc108ec"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your video..."
              rows={3}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] resize-none"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              htmlFor="field-79555a99"
            >
              Tags (comma separated)
            </label>
            <input
              id="field-79555a99"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="crypto, tutorial, review"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              htmlFor="field-960baa7a"
            >
              Category
            </label>
            <select
              id="field-960baa7a"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Visibility
            </span>
            <div className="flex gap-2">
              {(['public', 'unlisted', 'followers', 'token-gated'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${visibility === v ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'}`}
                >
                  {v === 'token-gated' ? 'Token Gated' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tipsEnabled}
                onChange={(e) => setTipsEnabled(e.target.checked)}
                className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
              />
              <span className="text-[10px] text-[var(--color-fg)]">Enable Tips</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tokenGated}
                onChange={(e) => setTokenGated(e.target.checked)}
                className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
              />
              <span className="text-[10px] text-[var(--color-fg)]">Token Gate</span>
            </label>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Publish to
            </span>
            <PublishTargetPills selected={publishTargets} onToggle={togglePublishTarget} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!title.trim()}
              className="flex-1 rounded-xl bg-degen-500 py-2.5 text-xs font-bold text-black hover:bg-degen-400 transition-all disabled:opacity-30"
            >
              Publish Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'publishing') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 h-16 w-16 animate-spin rounded-full border-3 border-degen-500 border-t-transparent" />
        <p className="text-sm font-medium text-[var(--color-fg)]">Uploading video...</p>
        <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full rounded-full bg-degen-500 transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">{uploadProgress}%</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="mb-3 text-5xl">🎉</span>
      <p className="text-lg font-bold text-degen-400 mb-1">Video Published!</p>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        Your video is live on {publishTargets.size} platform{publishTargets.size > 1 ? 's' : ''}.
      </p>
      <button
        type="button"
        onClick={handleReset}
        className="rounded-xl bg-degen-500 px-6 py-2.5 text-sm font-bold text-black hover:bg-degen-400 transition-all"
      >
        Upload Another
      </button>
    </div>
  );
}

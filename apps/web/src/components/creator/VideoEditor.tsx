'use client';

import { useCallback, useState } from 'react';
import type { CreatorVideoMeta } from './useCreatorVideos';
import { useCreatorVideoActions } from './useCreatorVideos';

// ─── Types ───────────────────────────────────────────────────────────────

interface VideoEditorProps {
  video: CreatorVideoMeta;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Video Editor Modal ──────────────────────────────────────────────────

export default function VideoEditor({ video, onClose, onSaved }: VideoEditorProps) {
  const { updateVideo } = useCreatorVideoActions();
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [tags, setTags] = useState(video.tags.join(', '));
  const [privacy, setPrivacy] = useState<1 | 2 | 3>(video.privacy);
  const [category, setCategory] = useState<number>(video.category);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const tagsList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await updateVideo(video.uuid, {
        title: title.trim(),
        description: description.trim(),
        tags: tagsList,
        privacy,
        category: category || undefined,
        thumbnail: thumbnail ?? undefined,
      });

      setSaved(true);
      onSaved?.();
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [title, description, tags, privacy, category, thumbnail, video.uuid, updateVideo, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-fg)]">Edit Video</h2>
            <p className="text-xs text-[var(--color-muted)] truncate max-w-sm">{video.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {saved ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-degen-500/20">
              <span className="text-xl text-degen-400">✓</span>
            </div>
            <p className="text-sm font-medium text-[var(--color-fg)]">Saved!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Tags */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
                />
              </div>

              {/* Privacy */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                  Privacy
                </label>
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
                >
                  <option value={1}>Public</option>
                  <option value={2}>Unlisted</option>
                  <option value={3}>Private</option>
                </select>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
              >
                <option value={1}>Music</option>
                <option value={2}>Films</option>
                <option value={10}>Technology</option>
                <option value={11}>Entertainment</option>
                <option value={12}>News & Politics</option>
                <option value={13}>Science & Education</option>
                <option value={14}>Gaming</option>
                <option value={15}>Sports</option>
                <option value={16}>Travel</option>
                <option value={17}>Comedy</option>
                <option value={18}>How-to & DIY</option>
                <option value={19}>Crypto & Web3</option>
              </select>
            </div>

            {/* Thumbnail */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                New Thumbnail (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-[var(--color-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-degen-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-degen-400 hover:file:bg-degen-500/30"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="btn-primary text-sm disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

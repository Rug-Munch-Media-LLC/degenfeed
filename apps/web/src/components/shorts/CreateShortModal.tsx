'use client';

/**
 * CreateShortModal — Modal for uploading a short video via PeerTube.
 * Allows setting title, description, and video URL.
 */

import { useCallback, useState } from 'react';

interface CreateShortModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: { id: string; title: string }) => void;
}

export function CreateShortModal({ open, onClose, onCreated }: CreateShortModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnailUrl('');
    setError(null);
    setSuccess(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!title.trim()) {
        setError('Title is required');
        return;
      }
      if (!videoUrl.trim()) {
        setError('Video URL is required');
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/shorts/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            videoUrl: videoUrl.trim(),
            thumbnailUrl: thumbnailUrl.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `Upload failed (${res.status})`);
        }

        const data = (await res.json()) as { success: boolean; short: { id: string; title: string } };
        setSuccess(true);
        onCreated?.(data.short);
        setTimeout(() => {
          resetForm();
          onClose();
        }, 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setSubmitting(false);
      }
    },
    [title, description, videoUrl, thumbnailUrl, onCreated, onClose, resetForm],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create short video"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {success ? 'Uploaded!' : 'Create Short'}
          </h2>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/20">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-degen-400">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Short submitted for review</p>
            <p className="text-xs text-[var(--color-muted)]">
              It will appear in the feed once approved by moderators.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <label htmlFor="short-title" className="mb-1 block text-xs font-medium text-white/70">
                Title *
              </label>
              <input
                id="short-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a catchy title..."
                maxLength={120}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="short-description" className="mb-1 block text-xs font-medium text-white/70">
                Description
              </label>
              <textarea
                id="short-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your short..."
                maxLength={500}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
              />
            </div>

            {/* Video URL */}
            <div>
              <label htmlFor="short-video-url" className="mb-1 block text-xs font-medium text-white/70">
                Video URL *
              </label>
              <input
                id="short-video-url"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://peertube.example.com/w/..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
              />
            </div>

            {/* Thumbnail URL */}
            <div>
              <label htmlFor="short-thumbnail" className="mb-1 block text-xs font-medium text-white/70">
                Thumbnail URL
              </label>
              <input
                id="short-thumbnail"
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/thumb.jpg"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-degen-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(0,255,65,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Uploading…' : 'Upload Short'}
            </button>

            <p className="text-center text-[10px] text-[var(--color-muted)]">
              Your short will be reviewed before appearing in the feed.
              <br />
              Supported: PeerTube, YouTube, and direct video URLs.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

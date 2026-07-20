'use client';

import { useCallback, useRef, useState } from 'react';
import { useCreatorVideoActions } from './useCreatorVideos';

// === Types ===============================================================

interface VideoUploaderProps {
  mode: 'video' | 'short';
  onClose: () => void;
  onSuccess?: (result: { uuid: string; title: string }) => void;
}

type UploadStage = 'select' | 'uploading' | 'done' | 'error';

// === Video Uploader Modal ================================================

export default function VideoUploader({ mode, onClose, onSuccess }: VideoUploaderProps) {
  const { uploadVideo, uploadShort } = useCreatorVideoActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<UploadStage>('select');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ uuid: string; url: string; title: string } | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState<1 | 2 | 3>(1);
  const [scheduleAt, setScheduleAt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isShort = mode === 'short';

  const handleFileSelect = useCallback((file: File) => {
    const maxSize = isShort ? 100 * 1024 * 1024 : 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Maximum: ${isShort ? '100MB' : '500MB'}`);
      return;
    }

    // Auto-fill title from filename
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(name.slice(0, 120));
    }

    setSelectedFile(file);
    setError(null);
  }, [isShort, title]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleFileSelect(file);
    } else {
      setError('Please select a video file');
    }
  }, [handleFileSelect]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setStage('uploading');
    setError(null);
    setProgress(0);

    // Simulate progress while uploading
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 500);

    try {
      const tagsList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (isShort) {
        const res = await uploadShort({
          file: selectedFile,
          title: title.trim(),
          description: description.trim(),
          tags: tagsList,
          thumbnail: thumbnail ?? undefined,
        });

        clearInterval(progressInterval);
        setProgress(100);
        setStage('done');
        setResult({ uuid: res.video.uuid, url: res.video.url, title: res.video.title });
        onSuccess?.({ uuid: res.video.uuid, title: res.video.title });
      } else {
        const res = await uploadVideo({
          file: selectedFile,
          title: title.trim(),
          description: description.trim(),
          tags: tagsList,
          privacy,
          thumbnail: thumbnail ?? undefined,
          scheduleAt: scheduleAt || undefined,
        });

        clearInterval(progressInterval);
        setProgress(100);
        setStage('done');
        setResult({ uuid: res.video.uuid, url: res.video.url, title: res.video.title });
        onSuccess?.({ uuid: res.video.uuid, title: res.video.title });
      }
    } catch (e) {
      clearInterval(progressInterval);
      setStage('error');
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }, [selectedFile, title, description, tags, privacy, scheduleAt, thumbnail, isShort, uploadVideo, uploadShort, onSuccess]);

  const handleReset = useCallback(() => {
    setStage('select');
    setProgress(0);
    setError(null);
    setResult(null);
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setTags('');
    setPrivacy(1);
    setScheduleAt('');
    setThumbnail(null);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-fg)]">
              {isShort ? 'Upload Short' : 'Upload Video'}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              {isShort
                ? 'Vertical video ≤60 seconds — appears in Shorts feed'
                : 'Upload video content — appears on Video Hub'}
            </p>
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

        {/* Select Stage */}
        {stage === 'select' && (
          <div className="space-y-5">
            {/* File drop zone */}
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? 'border-degen-500 bg-degen-500/10'
                  : selectedFile
                    ? 'border-degen-500/40 bg-degen-500/5'
                    : 'border-[var(--color-border)] bg-[var(--color-overlay)] hover:border-[var(--color-muted)]'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              role="button"
              tabIndex={0}
              aria-label="Select video file"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />

              {selectedFile ? (
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-degen-500/20 text-2xl text-degen-400">
                    🎬
                  </div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">{selectedFile.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-overlay)] text-2xl text-[var(--color-muted)]">
                    📹
                  </div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">
                    Drop video here or click to browse
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {isShort ? 'Max 100MB, vertical format' : 'Max 500MB, MP4/WebM'}
                  </p>
                </>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                maxLength={isShort ? 80 : 120}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50"
              />
              <span className="mt-1 block text-right text-[10px] text-[var(--color-muted)]">
                {title.length}/{isShort ? 80 : 120}
              </span>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your video..."
                rows={3}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50 resize-none"
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
                  placeholder="crypto, defi, tutorial"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50"
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

            {/* Schedule (optional) */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Schedule publish (optional)
              </label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
              />
            </div>

            {/* Thumbnail */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                Thumbnail (optional)
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
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedFile || !title.trim()}
                className="btn-primary text-sm disabled:opacity-40"
              >
                Upload {isShort ? 'Short' : 'Video'}
              </button>
            </div>
          </div>
        )}

        {/* Uploading Stage */}
        {stage === 'uploading' && (
          <div className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/20">
              <svg className="h-8 w-8 animate-spin text-degen-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">
              Uploading to PeerTube...
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Your video is being uploaded and transcoded. This may take a few minutes.
            </p>

            {/* Progress bar */}
            <div className="mx-auto max-w-xs">
              <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-1">
                <span>Uploading</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Done Stage */}
        {stage === 'done' && result && (
          <div className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/20">
              <span className="text-3xl text-degen-400">✓</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Upload Complete!</h3>
            <p className="text-xs text-[var(--color-muted)]">
              Your video "{result.title}" has been uploaded to PeerTube and is being processed.
              It will appear on the Video Hub shortly.
            </p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={handleReset} className="btn-secondary text-sm">
                Upload Another
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(result.url, '_blank', 'noopener,noreferrer');
                }}
                className="btn-primary text-sm"
              >
                View Video
              </button>
            </div>
          </div>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <div className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20">
              <span className="text-3xl text-red-400">!</span>
            </div>
            <h3 className="text-sm font-semibold text-red-400">Upload Failed</h3>
            <p className="text-xs text-[var(--color-muted)]">{error}</p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={handleReset} className="btn-secondary text-sm">
                Try Again
              </button>
              <button type="button" onClick={onClose} className="btn-primary text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

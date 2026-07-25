'use client';

import { useCallback, useRef, useState } from 'react';

export default function DropZone({
  onFile,
  accept = 'video/*',
  label = 'Drop video here or click to browse',
}: {
  onFile: (files: File[]) => void;
  accept?: string;
  label?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) onFile(Array.from(e.dataTransfer.files));
    },
    [onFile],
  );

  const handleClick = useCallback(() => inputRef.current?.click(), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) onFile(Array.from(e.target.files));
    },
    [onFile],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
        dragging
          ? 'border-degen-500 bg-degen-500/5'
          : 'border-[var(--color-glass-border)] hover:border-degen-500/30 hover:bg-[var(--color-overlay)]'
      }`}
    >
      <span className="mb-3 text-4xl" aria-hidden="true">
        {dragging ? '🎯' : '🎬'}
      </span>
      <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
        {dragging ? 'Drop it like it\'s hot!' : label}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
        Supports MP4, WebM, MOV &middot; Max 4GB
      </p>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
    </div>
  );
}

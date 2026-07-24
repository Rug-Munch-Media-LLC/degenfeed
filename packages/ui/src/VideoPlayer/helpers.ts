// ─── Helpers ──────────────────────────────────────────────────────────────

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getThumbnailUrl(youtubeId?: string, poster?: string): string | undefined {
  if (poster) return poster;
  if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  return undefined;
}

/** Dispatch a brief toast event that parent can listen for */
export function showToast(message: string) {
  window.dispatchEvent(
    new CustomEvent('df-toast', {
      detail: { kind: 'info', message, duration: 2000 },
    }),
  );
}

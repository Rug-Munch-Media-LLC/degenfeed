import { PROTOCOL_COLORS, PROTOCOL_LABELS } from './constants';

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function shortenPost(content: string, max = 60): string {
  if (content.length <= max) return content;
  return `${content.slice(0, max).trim()}…`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function protocolBadge(protocol: string): { bg: string; fg: string; label: string } {
  const color = PROTOCOL_COLORS[protocol] || '#666';
  return { bg: `${color}18`, fg: color, label: PROTOCOL_LABELS[protocol] || protocol };
}

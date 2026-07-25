import type { ProposalDetail } from './types';

export function getStatusBadge(status: ProposalDetail['status']): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'text-blue-400 bg-blue-500/15' },
    passed: { label: 'Passed', color: 'text-degen-400 bg-degen-500/15' },
    failed: { label: 'Failed', color: 'text-red-400 bg-red-500/15' },
    executed: { label: 'Executed', color: 'text-purple-400 bg-purple-500/15' },
  };
  return map[status] ?? { label: 'Active', color: 'text-blue-400 bg-blue-500/15' };
}

export function getTypeBadge(type: ProposalDetail['type']): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    standard: { label: 'Standard', color: 'text-blue-400 bg-blue-500/15' },
    treasury: { label: 'Treasury', color: 'text-degen-400 bg-degen-500/15' },
    constitutional: { label: 'Constitutional', color: 'text-purple-400 bg-purple-500/15' },
    signaling: { label: 'Signaling', color: 'text-amber-400 bg-amber-500/15' },
  };
  return map[type] ?? { label: 'Standard', color: 'text-blue-400 bg-blue-500/15' };
}

export function formatCountdown(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${mins}m left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

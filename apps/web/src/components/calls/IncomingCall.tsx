'use client';

import type { IncomingCall } from './types';

export default function IncomingCallBanner({
  call, onAccept, onDecline,
}: {
  call: IncomingCall;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const shortAddr = (addr: string) => addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;
  return (
    <div className="fixed inset-x-0 top-0 z-50 animate-in slide-in-from-top-2">
      <div className="mx-auto max-w-md rounded-b-2xl bg-gray-900/95 backdrop-blur-xl border-b border-x border-white/10 shadow-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-lg font-bold text-degen-400">
            {shortAddr(call.displayName).charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{call.displayName}</p>
            <p className="text-xs text-white/60">
              {call.type === 'audio' ? '\u{1F3A4}' : '\u{1F4F9}'} Incoming {call.type} call
              {call.participants > 1 ? ` (${call.participants} participants)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onAccept}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg"
              title="Accept call" aria-label="Accept call">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </button>
            <button type="button" onClick={onDecline}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
              title="Decline call" aria-label="Decline call">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CallButtons({
  peerId, peerDisplayName, onStartCall,
}: {
  peerId: string;
  peerDisplayName?: string;
  onStartCall: (type: 'audio' | 'video', peerId: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onStartCall('audio', peerId)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[var(--color-muted)] hover:bg-degen-500/20 hover:text-degen-400 transition-all"
        title={`Call ${peerDisplayName || peerId}`} aria-label={`Call ${peerDisplayName || peerId}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        </svg>
      </button>
      <button type="button" onClick={() => onStartCall('video', peerId)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[var(--color-muted)] hover:bg-degen-500/20 hover:text-degen-400 transition-all"
        title={`Video call ${peerDisplayName || peerId}`} aria-label={`Video call ${peerDisplayName || peerId}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
    </div>
  );
}

export function CallHistoryList({
  history, onClose,
}: {
  history: import('./types').CallHistoryEntry[];
  onClose: () => void;
}) {
  const shortAddr = (addr: string) => addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;
  const formatDuration = (ms: number): string => {
    if (ms === 0) return 'No answer';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-bold text-[var(--color-fg)]">Call History</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {history.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--color-muted)]">No call history</p>
          ) : history.map((entry) => (
            <div key={entry.callId} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[var(--color-overlay)] transition-colors">
              <span className="text-lg shrink-0">{entry.status === 'missed' ? '\u{274C}' : entry.type === 'audio' ? '\u{1F3A4}' : '\u{1F4F9}'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium text-[var(--color-fg)] truncate ${entry.status === 'missed' ? 'opacity-60' : ''}`}>
                  {entry.peer === 'Group Call' ? 'Group Call' : shortAddr(entry.peer)}
                </p>
                <p className="text-[10px] text-[var(--color-muted)]">
                  {entry.status === 'missed' ? 'Missed call' : formatDuration(entry.duration)}
                  {' \u00B7 '}
                  {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className={`text-[10px] font-medium ${entry.status === 'missed' ? 'text-red-400' : 'text-green-400'}`}>
                {entry.status === 'missed' ? 'Missed' : 'Completed'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

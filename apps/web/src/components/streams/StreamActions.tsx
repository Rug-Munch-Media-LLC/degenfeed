'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';
import type { LiveStream } from './useLiveStreams';

/* ─── Types ──────────────────────────────────────────────────── */

interface StreamActionsProps {
  stream: LiveStream;
  onTip?: (stream: LiveStream) => void;
  onBuyCoin?: (stream: LiveStream) => void;
  onShare?: (stream: LiveStream) => void;
  onFollow?: (stream: LiveStream) => void;
  isFollowing?: boolean;
}

/* ─── Icon components ────────────────────────────────────────── */

function TipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function FollowIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12" />
      <path d="M15 9h-4a2 2 0 000 4h2a2 2 0 010 4h-4" />
    </svg>
  );
}

/* ─── Action Button ──────────────────────────────────────────── */

function ActionBtn({
  label,
  icon,
  onClick,
  highlight = false,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  highlight?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
        highlight
          ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.3)]'
          : active
            ? 'bg-degen-500/15 text-degen-400'
            : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-[var(--color-fg)]'
      } active:scale-[0.97]`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export function StreamActions({
  stream,
  onTip,
  onBuyCoin,
  onShare,
  onFollow,
  isFollowing = false,
}: StreamActionsProps) {
  const { showToast } = useToast();
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const [following, setFollowing] = useState(isFollowing);

  const handleTip = useCallback(() => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to send tips');
      return;
    }
    onTip?.(stream);
    showToast('success', `Tip sent to @${stream.creatorHandle}!`);
  }, [hasSignedIn, onTip, stream, showToast]);

  const handleBuyCoin = useCallback(() => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to buy tokens');
      return;
    }
    onBuyCoin?.(stream);
  }, [hasSignedIn, onBuyCoin, stream, showToast]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/live/${stream.id}`;
    if (navigator.share) {
      await navigator.share({ title: stream.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('success', 'Stream link copied!');
    }
    onShare?.(stream);
  }, [stream, onShare, showToast]);

  const handleFollow = useCallback(() => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to follow');
      return;
    }
    const newFollowing = !following;
    setFollowing(newFollowing);
    onFollow?.(stream);
    showToast(
      newFollowing ? 'success' : 'info',
      newFollowing ? `Followed @${stream.creatorHandle}` : `Unfollowed @${stream.creatorHandle}`,
    );
  }, [hasSignedIn, following, onFollow, stream, showToast]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tip button */}
      <ActionBtn label="Tip" icon={<TipIcon />} onClick={handleTip} highlight />

      {/* Follow */}
      <ActionBtn
        label={following ? 'Following' : 'Follow'}
        icon={<FollowIcon active={following} />}
        onClick={handleFollow}
        active={following}
      />

      {/* Share */}
      <ActionBtn label="Share" icon={<ShareIcon />} onClick={handleShare} />

      {/* Buy coin (only for launch streams) */}
      {stream.streamType === 'launch' && stream.tokenSymbol && (
        <ActionBtn
          label={`Buy $${stream.tokenSymbol}`}
          icon={<CoinIcon />}
          onClick={handleBuyCoin}
          highlight
        />
      )}
    </div>
  );
}

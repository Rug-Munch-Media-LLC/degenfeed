'use client';

import { useRouter } from 'next/navigation';
import { getProfileUrl } from '../SearchHelpers';
import { ProtocolBadge, ResultAvatar } from '../SearchIcons';
import type { FlatItem, IdentityResult } from '../SearchTypes';

interface Props {
  identities: IdentityResult[];
  flatItems: FlatItem[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onClose: () => void;
  query: string;
  onCommitSearch: (q: string) => void;
}

export function PeopleSection({
  identities,
  flatItems,
  selectedIndex,
  onSelectIndex,
  onClose,
  query,
  onCommitSearch,
}: Props) {
  const router = useRouter();
  if (identities.length === 0) return null;
  return (
    <div>
      <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
        People
      </div>
      {identities.map((identity) => {
        const globalIdx = flatItems.findIndex(
          (fi) => fi.type === 'identity' && (fi.data as IdentityResult).id === identity.id,
        );
        return (
          <button
            key={identity.id}
            type="button"
            data-result-idx={globalIdx}
            onClick={() => {
              onCommitSearch(query);
              router.push(getProfileUrl(identity));
              onClose();
            }}
            onMouseEnter={() => onSelectIndex(globalIdx)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${selectedIndex === globalIdx ? 'bg-degen-500/10' : 'hover:bg-[var(--color-overlay)]'}`}
          >
            <ResultAvatar
              url={identity.avatarUrl}
              fallback={identity.displayName}
              protocol={identity.protocol}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {identity.displayName}
                </span>
                <ProtocolBadge protocol={identity.protocol} />
              </div>
              {identity.handle && (
                <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                  {identity.handle}
                </div>
              )}
            </div>
            <span className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)]">
              View
            </span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { formatCount } from '../SearchHelpers';
import { ProtocolBadge, ResultAvatar } from '../SearchIcons';
import type { CommunityResult, FlatItem } from '../SearchTypes';

interface Props {
  communities: CommunityResult[];
  flatItems: FlatItem[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onClose: () => void;
  query: string;
  onCommitSearch: (q: string) => void;
}

export function CommunitiesSection({
  communities,
  flatItems,
  selectedIndex,
  onSelectIndex,
  onClose,
  query,
  onCommitSearch,
}: Props) {
  if (communities.length === 0) return null;
  return (
    <div>
      <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
        Communities
      </div>
      {communities.map((community) => {
        const globalIdx = flatItems.findIndex(
          (fi) => fi.type === 'community' && (fi.data as CommunityResult).id === community.id,
        );
        return (
          <button
            key={community.id}
            type="button"
            data-result-idx={globalIdx}
            onClick={() => {
              onCommitSearch(query);
              window.open(community.url, '_blank', 'noopener,noreferrer');
              onClose();
            }}
            onMouseEnter={() => onSelectIndex(globalIdx)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${selectedIndex === globalIdx ? 'bg-degen-500/10' : 'hover:bg-[var(--color-overlay)]'}`}
          >
            <ResultAvatar
              url={community.icon}
              fallback={community.name}
              protocol={community.protocol}
              rounded="xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {community.name}
                </span>
                <ProtocolBadge protocol={community.protocol} />
              </div>
              {community.description && (
                <div className="text-xs text-[var(--color-muted)] line-clamp-1 mt-0.5">
                  {community.description}
                </div>
              )}
              {community.memberCount > 0 && (
                <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                  {formatCount(community.memberCount)} members
                </div>
              )}
            </div>
            <span className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)]">
              Join
            </span>
          </button>
        );
      })}
    </div>
  );
}

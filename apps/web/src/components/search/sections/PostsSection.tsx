'use client';

import { getProtocolColor } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatDate } from '../SearchHelpers';
import { ProtocolBadge } from '../SearchIcons';
import type { FlatItem, SearchResult } from '../SearchTypes';

interface Props {
  results: SearchResult[];
  flatItems: FlatItem[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onClose: () => void;
  query: string;
  onCommitSearch: (q: string) => void;
}

export function PostsSection({
  results,
  flatItems,
  selectedIndex,
  onSelectIndex,
  onClose,
  query,
  onCommitSearch,
}: Props) {
  const router = useRouter();
  if (results.length === 0) return null;
  return (
    <div>
      <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
        Posts
      </div>
      {results.map((r) => {
        const globalIdx = flatItems.findIndex(
          (fi) => fi.type === 'post' && (fi.data as SearchResult).id === r.id,
        );
        return (
          <button
            key={r.id}
            type="button"
            data-result-idx={globalIdx}
            onClick={() => {
              onCommitSearch(query);
              router.push(`/post/${encodeURIComponent(r.id)}`);
              onClose();
            }}
            onMouseEnter={() => onSelectIndex(globalIdx)}
            className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${selectedIndex === globalIdx ? 'bg-degen-500/10' : 'hover:bg-[var(--color-overlay)]'}`}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden"
              style={{
                backgroundColor: `${getProtocolColor(r.protocol)}22`,
                color: getProtocolColor(r.protocol),
              }}
            >
              {r.author.avatarUrl ? (
                <Image
                  src={r.author.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                r.author.displayName[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-[var(--color-fg)] truncate">
                  {r.author.displayName}
                </span>
                <ProtocolBadge protocol={r.protocol} />
                <span className="ml-auto text-[var(--color-muted)] shrink-0">
                  {formatDate(r.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--color-muted)] line-clamp-2 leading-normal">
                {r.text}
              </p>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                <span className="flex items-center gap-1">
                  <span>♥</span> <span>{r.metrics.likes}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span>↻</span> <span>{r.metrics.reposts}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span>✎</span> <span>{r.metrics.replies}</span>
                </span>
              </div>
            </div>
            {r.image && (
              <Image
                src={r.image}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

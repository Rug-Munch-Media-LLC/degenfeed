import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

export interface ComposePreviewTarget {
  id: string;
  enabled: boolean;
  charLimit: number;
}

export interface ComposePreviewAuthor {
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
}

export interface ComposePreviewProps {
  text: string;
  targets: ComposePreviewTarget[];
  author?: ComposePreviewAuthor;
}

export function ComposePreview({ text, targets, author }: ComposePreviewProps) {
  const trimmed = text.trim();
  if (!trimmed && targets.every((t) => !t.enabled)) return null;

  const active = targets.filter((t) => t.enabled);
  const hasPreview = trimmed.length > 0;

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
      {hasPreview && (
        <div className="mb-3 flex gap-3">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-[var(--color-muted)]">
            {author?.avatarUrl ? (
              <img
                src={author.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                ?
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-[var(--color-fg)]">
                {author?.displayName || 'You'}
              </span>
              {author?.handle && (
                <span className="truncate text-sm text-gray-500">@{author.handle}</span>
              )}
              <span className="text-xs text-gray-600">· now</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-200">{trimmed}</p>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {active.map((target) => {
            const color = getProtocolColor(target.id);
            const label = getProtocolLabel(target.id);
            const icon = getProtocolIcon(target.id);
            const overLimit = trimmed.length > target.charLimit;
            return (
              <div
                key={target.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  overLimit ? 'text-red-400' : ''
                }`}
                style={{
                  backgroundColor: overLimit ? 'rgba(248,113,113,0.12)' : `${color}18`,
                }}
                title={overLimit ? `${label} limit is ${target.charLimit} characters` : label}
              >
                <span className="text-[0.7em]" style={{ color: overLimit ? undefined : color }}>
                  {icon}
                </span>
                <span>{label}</span>
                <span className="opacity-70">
                  {trimmed.length}/{target.charLimit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

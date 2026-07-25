'use client';

interface SearchEmptyProps {
  query: string;
  hasFilters: boolean;
}

export function SearchEmpty({ query, hasFilters }: SearchEmptyProps) {
  return (
    <div className="card py-12 text-center">
      <div className="mb-3 text-3xl text-[var(--color-muted)]">⌕</div>
      <p className="text-sm text-[var(--color-muted)]">No results for &ldquo;{query}&rdquo;</p>
      {hasFilters && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">Try removing the protocol filter</p>
      )}
    </div>
  );
}

'use client';

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mb-4 text-4xl text-gray-700">⚠</div>
      <h2 className="mb-2 text-lg font-semibold text-white">Search Error</h2>
      <p className="mb-6 text-sm text-gray-500">{error.message || 'Something went wrong'}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-degen-500/20 px-4 py-2 text-sm font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

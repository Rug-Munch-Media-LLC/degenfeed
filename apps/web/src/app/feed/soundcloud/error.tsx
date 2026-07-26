'use client';

export default function FeedError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-gray-400 mb-6">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

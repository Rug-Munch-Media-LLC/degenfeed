export default function FeedLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-400">Loading feed...</p>
    </div>
  );
}

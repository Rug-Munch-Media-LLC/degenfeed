export default function ContentLibraryLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-pulse">
      <div className="mb-6 h-8 w-48 skeleton rounded-lg" />
      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 skeleton rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton rounded-xl" />
        ))}
      </div>
    </div>
  );
}

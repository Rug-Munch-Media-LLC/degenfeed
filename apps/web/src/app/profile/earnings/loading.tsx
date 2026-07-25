export default function EarningsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-pulse">
      <div className="mb-8 h-8 w-56 skeleton rounded-lg" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 skeleton rounded-xl" />
        ))}
      </div>
      <div className="h-48 skeleton rounded-xl" />
    </div>
  );
}

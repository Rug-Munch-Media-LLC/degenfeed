export default function CoinDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
        <div className="w-full space-y-4 lg:w-96">
          <div className="skeleton h-96 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

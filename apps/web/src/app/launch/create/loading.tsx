export default function CreateCoinLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 animate-page-enter">
      {/* Step indicator skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center">
              <div className="skeleton h-8 w-8 rounded-full" />
              {i < 5 && <div className="mx-2 skeleton h-0.5 w-12 sm:w-20" />}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="skeleton h-6 w-48 rounded-lg" />
        <div className="skeleton h-5 w-72 rounded-lg" />
        <div className="skeleton h-52 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="skeleton h-10 w-20 rounded-lg" />
        <div className="skeleton h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

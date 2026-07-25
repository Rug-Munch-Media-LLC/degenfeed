/**
 * PageSkeleton — Generic loading skeleton for page transitions
 */

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-pulse">
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-4 h-24 w-24 rounded-full skeleton" />
        <div className="mb-2 h-7 w-48 skeleton rounded-lg" />
        <div className="mb-1 h-4 w-32 skeleton rounded-lg" />
        <div className="h-4 w-64 skeleton rounded-lg" />
      </div>
      <div className="mb-6 flex justify-center gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-20 skeleton rounded-xl" />
        ))}
      </div>
      <div className="mb-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-8 skeleton rounded-full" />
        ))}
      </div>
      <div className="mb-6 h-10 skeleton rounded-xl" />
      <div className="mb-6 flex justify-center gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-20 skeleton rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default PageSkeleton;

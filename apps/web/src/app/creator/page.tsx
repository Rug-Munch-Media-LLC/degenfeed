import dynamic from 'next/dynamic';

const CreatorPageContent = dynamic(() => import('./CreatorPageContent'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="skeleton h-8 w-64 rounded-lg mb-6" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-6 skeleton h-64 rounded-xl" />
    </div>
  ),
});

export default function Page() {
  return <CreatorPageContent />;
}

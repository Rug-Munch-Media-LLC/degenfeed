import dynamic from 'next/dynamic';

const MutedPageContent = dynamic(() => import('./MutedPageContent'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="skeleton h-8 w-48 rounded-lg mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  ),
});

export default function Page() {
  return <MutedPageContent />;
}

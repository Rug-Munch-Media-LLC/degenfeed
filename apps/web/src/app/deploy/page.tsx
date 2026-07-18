import dynamic from 'next/dynamic';

const DeployPageContent = dynamic(() => import('./DeployPageContent'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 h-16 w-16 skeleton rounded-2xl" />
        <div className="mx-auto skeleton h-10 w-96 rounded-lg" />
        <div className="mx-auto mt-4 skeleton h-6 w-[500px] rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-96 rounded-2xl" />
        ))}
      </div>
    </div>
  ),
});

export default function Page() {
  return <DeployPageContent />;
}

export default function CommunityLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
      <div className="skeleton h-8 w-48 rounded-lg mb-6" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-96 w-full rounded-xl" />
        </div>
        <div className="w-full space-y-4 lg:w-80">
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * DegenFeed — Single Post View
 * Route: /post/[id]
 * Full thread context with replies and engagement UI.
 */

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const postId = decodeURIComponent(id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <a href="/home" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white">
        &larr; Back to feed
      </a>

      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">Post</h1>
        <p className="text-sm text-gray-500">{postId}</p>
      </div>

      {/* TODO(v1): Fetch single post + render thread with replies */}
      <div className="card py-12 text-center">
        <p className="text-gray-500">Post detail view coming soon...</p>
        <p className="mt-2 text-xs text-gray-600">Full thread with replies, engagement, and context.</p>
      </div>
    </div>
  );
}

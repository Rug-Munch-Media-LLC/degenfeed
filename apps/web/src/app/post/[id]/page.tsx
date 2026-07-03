/**
 * Single post view. Shows a post and its replies.
 *
 * Route: /post/[id]
 * The id is the canonical `${protocol}:${nativeId}`.
 *
 * TODO(v1):
 *   - Fetch post from relay/hub/API by id
 *   - Show full post with embeds
 *   - Show reply thread
 *   - Add reply compose box
 *   - Add reaction buttons
 */

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button type="button" className="btn-ghost mb-4" onClick={() => window.history.back()}>
        ← Back
      </button>
      <div className="card">
        <p className="text-sm text-gray-500">Post ID: {id}</p>
        <p className="mt-4 text-gray-400">Loading post from protocol...</p>
      </div>
    </div>
  );
}

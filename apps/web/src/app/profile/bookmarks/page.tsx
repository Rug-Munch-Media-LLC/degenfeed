'use client';

import { getBookmarks, removeBookmark } from '@degenfeed/storage';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface BookmarkEntry { postId: string; savedAt: number; title?: string; protocol?: string; }

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getBookmarks();
      setBookmarks(items as BookmarkEntry[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (postId: string) => {
    await removeBookmark(postId);
    setBookmarks((prev) => prev.filter((b) => b.postId !== postId));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Reading List</p>
          <h1 className="text-2xl font-bold text-white">Bookmarks</h1>
        </div>
        <Link href="/home" className="text-sm text-gray-500 hover:text-white transition-colors">&larr; Feed</Link>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="mb-2 h-4 w-48 rounded bg-gray-800" />
              <div className="h-3 w-32 rounded bg-gray-800" />
            </div>
          ))}
        </div>
      )}

      {!loading && bookmarks.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-gray-500">No bookmarks yet.</p>
          <p className="mt-1 text-sm text-gray-600">Bookmark posts from your feed to save them here.</p>
          <Link href="/home" className="btn-primary mt-4 inline-block text-sm">Browse the feed</Link>
        </div>
      )}

      {!loading && bookmarks.length > 0 && (
        <div className="space-y-2">
          {bookmarks.map((b) => (
            <div key={b.postId} className="card flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/post/${encodeURIComponent(b.postId)}`} className="font-medium text-sm text-white hover:text-degen-400 transition-colors truncate block">
                  {b.title || b.postId}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                  {b.protocol && <span>{b.protocol}</span>}
                  <span>{new Date(b.savedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(b.postId)}
                className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

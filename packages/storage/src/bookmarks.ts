import { getDb } from './db';

export interface StoredBookmark {
  postId: string;
  savedAt: number;
}

export async function addBookmark(postId: string): Promise<void> {
  const db = await getDb();
  await db.put('bookmarks', { postId, savedAt: Date.now() });
}

export async function removeBookmark(postId: string): Promise<void> {
  const db = await getDb();
  await db.delete('bookmarks', postId);
}

export async function isBookmarked(postId: string): Promise<boolean> {
  const db = await getDb();
  const found = await db.get('bookmarks', postId);
  return !!found;
}

export async function getBookmarks(): Promise<StoredBookmark[]> {
  const db = await getDb();
  return db.getAll('bookmarks');
}

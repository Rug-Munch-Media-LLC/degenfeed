'use client';

import { getDb } from '@degenfeed/storage';
import { useCallback, useEffect, useState } from 'react';

export interface ScheduledPost {
  id: string;
  text: string;
  scheduledAt: string; // ISO string
  targets: string[];
  createdAt: string;
}

async function loadAll(): Promise<ScheduledPost[]> {
  try {
    const db = await getDb();
    return (await db.getAll('scheduled')) as ScheduledPost[];
  } catch {
    return [];
  }
}

async function persist(posts: ScheduledPost[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('scheduled', 'readwrite');
  const store = tx.objectStore('scheduled');
  await store.clear();
  for (const post of posts) {
    await store.put(post);
  }
  await tx.done;
}

export function useScheduledPosts() {
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);

  useEffect(() => {
    loadAll().then(setScheduled);
  }, []);

  // Stable refs — intentional mount-only effect
  useEffect(() => {
    const fn = async () => {
      const due = await getDuePosts();
      for (const post of due) {
        publishNow(post.id);
      }
    };
    const interval = setInterval(fn, 60000);
    return () => clearInterval(interval);
  }, [publishNow, getDuePosts]);

  const schedulePost = useCallback((text: string, targets: string[], scheduledAt: Date) => {
    const post: ScheduledPost = {
      id: crypto.randomUUID(),
      text,
      targets,
      scheduledAt: scheduledAt.toISOString(),
      createdAt: new Date().toISOString(),
    };
    loadAll().then((all) => {
      const next = [...all, post];
      persist(next);
      setScheduled(next);
    });
  }, []);

  const cancelSchedule = useCallback((id: string) => {
    loadAll().then((all) => {
      const next = all.filter((p) => p.id !== id);
      persist(next);
      setScheduled(next);
    });
  }, []);

  const publishNow = useCallback((id: string) => {
    loadAll().then((all) => {
      const post = all.find((p) => p.id === id) ?? null;
      if (!post) return;
      const next = all.filter((p) => p.id !== id);
      persist(next);
      setScheduled(next);
    });
  }, []);

  /** Returns posts whose scheduled time has passed (for background processing). */
  const getDuePosts = useCallback(async (): Promise<ScheduledPost[]> => {
    const now = new Date();
    const all = await loadAll();
    return all.filter((p) => new Date(p.scheduledAt) <= now);
  }, []);

  return { scheduled, schedulePost, cancelSchedule, publishNow, getDuePosts } as const;
}

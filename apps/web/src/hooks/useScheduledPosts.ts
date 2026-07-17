'use client';

import { useCallback, useState } from 'react';

export interface ScheduledPost {
  id: string;
  text: string;
  scheduledAt: string; // ISO string
  targets: string[];
  createdAt: string;
}

const STORAGE_KEY = 'df_scheduled_posts';

function loadAll(): ScheduledPost[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persist(posts: ScheduledPost[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

export function useScheduledPosts() {
  const [scheduled, setScheduled] = useState<ScheduledPost[]>(loadAll);

  const schedulePost = useCallback(
    (text: string, targets: string[], scheduledAt: Date) => {
      const post: ScheduledPost = {
        id: crypto.randomUUID(),
        text,
        targets,
        scheduledAt: scheduledAt.toISOString(),
        createdAt: new Date().toISOString(),
      };
      const next = [...loadAll(), post];
      persist(next);
      setScheduled(next);
    },
    [],
  );

  const cancelSchedule = useCallback((id: string) => {
    const next = loadAll().filter((p) => p.id !== id);
    persist(next);
    setScheduled(next);
  }, []);

  const publishNow = useCallback((id: string) => {
    const all = loadAll();
    const post = all.find((p) => p.id === id) ?? null;
    if (!post) return null;
    const next = all.filter((p) => p.id !== id);
    persist(next);
    setScheduled(next);
    return post;
  }, []);

  /** Returns posts whose scheduled time has passed (for background processing). */
  const getDuePosts = useCallback(() => {
    const now = new Date();
    return loadAll().filter((p) => new Date(p.scheduledAt) <= now);
  }, []);

  return { scheduled, schedulePost, cancelSchedule, publishNow, getDuePosts } as const;
}

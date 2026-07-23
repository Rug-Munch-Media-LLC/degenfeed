'use client';

import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';

// === Types ===============================================================

/** Video metadata from the creator API. */
export interface CreatorVideoMeta {
  uuid: string;
  title: string;
  description?: string;
  url?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  views?: number;
  state?: string;
  isShort?: boolean;
  createdAt?: string;
  privacy?: number;
  tags: string[];
  category?: number;
  isLive?: boolean;
  source?: string;
}

/** Analytics data for a single video. */
export interface VideoAnalytics {
  totalViews: number;
  totalLikes: number;
  totalTips: number;
  totalTipsUsdCents: number;
  avgWatchTimeS: number;
  completionRate: number;
  viewsOverTime: Array<{ date: string; count: number }>;
  tipsOverTime: Array<{ date: string; count: number }>;
  sourceBreakdown: Record<string, number>;
  protocolBreakdown: Record<string, number>;
}

export interface UploadVideoInput {
  file: File | Blob;
  title: string;
  description?: string;
  tags?: string[];
  category?: number;
  privacy?: 1 | 2 | 3;
  thumbnail?: File | Blob;
  scheduleAt?: string;
  isShort?: boolean;
}

export interface UploadResult {
  ok: boolean;
  video: {
    uuid: string;
    url: string;
    embedUrl: string;
    title: string;
    isShort: boolean;
    state: string;
  };
  error?: string;
}

export interface VideosResponse {
  videos: CreatorVideoMeta[];
  total: number;
}

export interface VideoDetailResponse {
  video: CreatorVideoMeta;
  analytics: VideoAnalytics | null;
}

// === Fetcher =============================================================

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
};

// === Hook: Creator's video library =======================================

export function useCreatorVideos(type?: 'video' | 'short') {
  const params = type ? `?type=${type}` : '';
  const { data, error, isLoading, isValidating } = useSWR<VideosResponse>(
    `/api/creator/videos${params}`,
    fetcher,
    {
      refreshInterval: 30000, // Poll every 30s for state updates
      revalidateOnFocus: true,
    },
  );

  return {
    videos: data?.videos ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
    isValidating,
  };
}

// === Hook: Single video details ==========================================

export function useCreatorVideo(uuid: string | null) {
  const { data, error, isLoading } = useSWR<VideoDetailResponse>(
    uuid ? `/api/creator/videos/${uuid}` : null,
    fetcher,
    { refreshInterval: 15000 },
  );

  return {
    video: data?.video ?? null,
    analytics: data?.analytics ?? null,
    loading: isLoading,
    error: error?.message ?? null,
  };
}

// === Hook: Video upload actions ==========================================

export function useCreatorVideoActions() {
  const uploadVideo = useCallback(async (input: UploadVideoInput): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('title', input.title);
    if (input.description) formData.append('description', input.description);
    if (input.tags && input.tags.length > 0) formData.append('tags', input.tags.join(','));
    if (input.category !== undefined) formData.append('category', String(input.category));
    if (input.privacy) formData.append('privacy', String(input.privacy));
    if (input.thumbnail) formData.append('thumbnail', input.thumbnail);
    if (input.scheduleAt) formData.append('scheduleAt', input.scheduleAt);
    if (input.isShort) formData.append('isShort', 'true');

    const res = await fetch('/api/creator/videos/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? 'Upload failed');
    }

    // Revalidate video list
    mutate('/api/creator/videos');
    return data as UploadResult;
  }, []);

  const uploadShort = useCallback(async (input: {
    file: File | Blob;
    title: string;
    description?: string;
    tags?: string[];
    thumbnail?: File | Blob;
  }): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('title', input.title);
    if (input.description) formData.append('description', input.description);
    if (input.tags) formData.append('tags', input.tags.join(','));
    if (input.thumbnail) formData.append('thumbnail', input.thumbnail);

    const res = await fetch('/api/creator/videos/short', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? 'Short upload failed');
    }

    mutate('/api/creator/videos');
    mutate('/api/creator/videos?type=short');
    return data as UploadResult;
  }, []);

  const updateVideo = useCallback(async (
    uuid: string,
    input: Partial<UploadVideoInput>,
  ): Promise<boolean> => {
    const formData = new FormData();
    if (input.title) formData.append('title', input.title);
    if (input.description !== undefined) formData.append('description', input.description);
    if (input.tags) formData.append('tags', input.tags.join(','));
    if (input.category !== undefined) formData.append('category', String(input.category));
    if (input.privacy) formData.append('privacy', String(input.privacy));
    if (input.thumbnail) formData.append('thumbnail', input.thumbnail);

    const res = await fetch(`/api/creator/videos/${uuid}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(data.error);
    }

    mutate('/api/creator/videos');
    mutate(`/api/creator/videos/${uuid}`);
    return true;
  }, []);

  const deleteVideo = useCallback(async (uuid: string): Promise<boolean> => {
    const res = await fetch(`/api/creator/videos/${uuid}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(data.error);
    }

    mutate('/api/creator/videos');
    return true;
  }, []);

  return {
    uploadVideo,
    uploadShort,
    updateVideo,
    deleteVideo,
  };
}

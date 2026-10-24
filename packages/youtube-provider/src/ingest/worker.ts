/**
 * Bounded, resumable per-channel ingest.
 *
 * Order of operations: backoff gate → rate-limit token → RSS fetch → per-video
 * metadata/transcript (optional) → idempotent upsert. Nothing here downloads media.
 */

import type { RSSEntry, YouTubeChannel } from '../youtube/types';
import { type BackoffState, type FailureKind, isReady, nextBackoff, resetBackoff } from './backoff';
import type { TokenBucket } from './pacing';
import { buildVideoRecord } from './record';
import { buildShillCandidates } from './shill';
import type { IngestStore } from './store';
import { normalizeTranscript } from './transcript';
import type { FetchProvenance, Transcript, VideoRecord, YtDlpMetadata } from './types';

export interface IngestDeps {
  fetchEntries: (channel: YouTubeChannel) => Promise<RSSEntry[]>;
  fetchMetadata?: (videoId: string) => Promise<YtDlpMetadata | null>;
  fetchTranscript?: (videoId: string) => Promise<Transcript | null>;
  store: IngestStore;
  bucket: TokenBucket;
  now: () => number;
  maxVideos?: number;
  /** Only ingest entries published strictly after this epoch ms (resume cursor). */
  sinceMs?: number;
}

export interface ChannelResult {
  channelId: string;
  status: 'ok' | 'backoff' | 'rate_limited' | 'error';
  inserted: number;
  updated: number;
  candidates: number;
  cursorMs: number | null;
  backoff: BackoffState;
  error?: string;
}

function provenanceFor(
  channel: YouTubeChannel,
  fetchedAtMs: number,
  useYtDlp: boolean,
): FetchProvenance {
  return {
    sourceUrl:
      channel.feed ?? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    method: useYtDlp ? 'yt-dlp' : 'rss',
  };
}

function errorKind(err: unknown): FailureKind {
  const message = err instanceof Error ? err.message : String(err);
  return /HTTP 40[14]|HTTP 410|not found/i.test(message) ? 'gone' : 'transient';
}

/** Ingest one channel. Never throws: failures become `status: 'error'` + backoff. */
export async function ingestChannel(
  channel: YouTubeChannel,
  deps: IngestDeps,
  priorBackoff?: BackoffState,
): Promise<ChannelResult> {
  const nowMs = deps.now();
  const empty = { channelId: channel.channelId, inserted: 0, updated: 0, candidates: 0 };

  if (!isReady(priorBackoff, nowMs)) {
    return {
      ...empty,
      status: 'backoff',
      cursorMs: null,
      backoff: priorBackoff as BackoffState,
    };
  }
  if (!deps.bucket.tryTake(nowMs)) {
    return { ...empty, status: 'rate_limited', cursorMs: null, backoff: resetBackoff() };
  }

  try {
    const entries = await deps.fetchEntries(channel);
    const bounded = entries
      .filter((entry) => {
        if (!entry.videoId) return false;
        if (deps.sinceMs === undefined) return true;
        const published = Date.parse(entry.published);
        return Number.isFinite(published) ? published > deps.sinceMs : true;
      })
      .slice(0, deps.maxVideos ?? 15);

    let inserted = 0;
    let updated = 0;
    let candidates = 0;
    let cursorMs: number | null = null;

    for (const entry of bounded) {
      const metadata = deps.fetchMetadata ? await deps.fetchMetadata(entry.videoId) : null;
      const transcript = deps.fetchTranscript
        ? await deps.fetchTranscript(entry.videoId)
        : normalizeTranscript(null, null, null);
      const record: VideoRecord = buildVideoRecord({
        videoId: entry.videoId,
        channelId: channel.channelId,
        channelName: channel.name,
        title: entry.title,
        description: entry.description ?? '',
        publishedAt: entry.published,
        rssDurationSeconds: entry.duration,
        rssViews: entry.views,
        metadata,
        transcript,
        provenance: provenanceFor(channel, nowMs, Boolean(deps.fetchMetadata)),
      });

      const outcome = deps.store.upsertVideo(record);
      if (outcome === 'inserted') inserted++;
      else updated++;

      for (const candidate of buildShillCandidates(record)) {
        const shillOutcome = deps.store.upsertShill(candidate);
        if (shillOutcome === 'inserted') candidates++;
      }

      const publishedMs = Date.parse(record.publishedAt);
      if (Number.isFinite(publishedMs) && (cursorMs === null || publishedMs > cursorMs)) {
        cursorMs = publishedMs;
      }
    }

    return {
      channelId: channel.channelId,
      status: 'ok',
      inserted,
      updated,
      candidates,
      cursorMs,
      backoff: resetBackoff(),
    };
  } catch (err) {
    return {
      ...empty,
      status: 'error',
      cursorMs: null,
      backoff: nextBackoff(priorBackoff, nowMs, errorKind(err)),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

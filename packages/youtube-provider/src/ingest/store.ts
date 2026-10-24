/**
 * In-memory ingest store with idempotent upsert — the shape a durable
 * (Postgres/ClickHouse) store must implement. Keyed by video id / candidate id,
 * so replaying the same feed is a no-op.
 */
import type { ShillCandidate, VideoRecord, ViewsSnapshot } from './types';

export interface IngestStore {
  upsertVideo(record: VideoRecord): 'inserted' | 'updated';
  upsertShill(candidate: ShillCandidate): 'inserted' | 'updated';
  getVideo(videoId: string): VideoRecord | undefined;
  videos(): VideoRecord[];
  shills(): ShillCandidate[];
  stats(): { videos: number; shills: number; duplicates: number };
}

function mergeViews(existing: ViewsSnapshot[], incoming: ViewsSnapshot[]): ViewsSnapshot[] {
  const byAt = new Map<string, ViewsSnapshot>();
  for (const snapshot of existing) byAt.set(snapshot.at, snapshot);
  for (const snapshot of incoming) byAt.set(snapshot.at, snapshot);
  return [...byAt.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** Richer transcript wins; a `disabled` fetch never erases a stored transcript. */
function mergeVideo(existing: VideoRecord, incoming: VideoRecord): VideoRecord {
  const keepTranscript =
    existing.transcript.segments.length > 0 && incoming.transcript.segments.length === 0;
  return {
    ...incoming,
    transcript: keepTranscript ? existing.transcript : incoming.transcript,
    views: mergeViews(existing.views, incoming.views),
    provenance: existing.provenance,
  };
}

export function createIngestStore(): IngestStore {
  const videoById = new Map<string, VideoRecord>();
  const shillById = new Map<string, ShillCandidate>();
  let duplicates = 0;

  return {
    upsertVideo(record) {
      const existing = videoById.get(record.videoId);
      if (!existing) {
        videoById.set(record.videoId, record);
        return 'inserted';
      }
      duplicates++;
      videoById.set(record.videoId, mergeVideo(existing, record));
      return 'updated';
    },
    upsertShill(candidate) {
      if (shillById.has(candidate.id)) {
        duplicates++;
        const existing = shillById.get(candidate.id) as ShillCandidate;
        shillById.set(candidate.id, { ...candidate, quote: existing.quote });
        return 'updated';
      }
      shillById.set(candidate.id, candidate);
      return 'inserted';
    },
    getVideo(videoId) {
      return videoById.get(videoId);
    },
    videos() {
      return [...videoById.values()];
    },
    shills() {
      return [...shillById.values()];
    },
    stats() {
      return { videos: videoById.size, shills: shillById.size, duplicates };
    },
  };
}

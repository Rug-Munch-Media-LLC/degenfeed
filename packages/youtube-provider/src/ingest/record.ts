/**
 * VideoRecord assembly: RSS entry (+ optional yt-dlp metadata / transcript)
 * → one immutable record, with every extraction and its provenance.
 */
import { extractAddresses, extractCashtags, extractLinks, scanLexicon } from './extract';
import { normalizeTranscript } from './transcript';
import type {
  FetchProvenance,
  LexiconHit,
  Transcript,
  VideoRecord,
  ViewsSnapshot,
  YtDlpMetadata,
} from './types';

export interface RecordInput {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  publishedAt: string;
  rssDurationSeconds?: number;
  rssViews?: number;
  metadata?: YtDlpMetadata | null;
  transcript?: Transcript | null;
  provenance: FetchProvenance;
}

function buildViews(input: RecordInput): ViewsSnapshot[] {
  const views = input.metadata?.view_count ?? input.rssViews;
  if (typeof views !== 'number' || !Number.isFinite(views) || views < 0) return [];
  return [{ at: input.provenance.fetchedAt, views }];
}

function transcriptText(transcript: Transcript): string {
  return transcript.segments.map((segment) => segment.text).join(' ');
}

/** Stable identity is the video id — never the title (titles are editable). */
export function buildVideoRecord(input: RecordInput): VideoRecord {
  const transcript = input.transcript ?? normalizeTranscript(null, null, 'disabled');
  const description = input.metadata?.description ?? input.description;
  const transcriptBody = transcriptText(transcript);
  const searchable = `${input.title}\n${description}\n${transcriptBody}`;

  const lexicon: LexiconHit[] = [
    ...scanLexicon(input.title, 'title'),
    ...scanLexicon(description, 'description'),
    ...scanLexicon(transcriptBody, 'transcript'),
  ];

  const duration = input.metadata?.duration ?? input.rssDurationSeconds ?? null;

  return {
    videoId: input.videoId,
    channelId: input.channelId,
    channelName: input.metadata?.channel ?? input.channelName,
    title: input.metadata?.title ?? input.title,
    description,
    publishedAt: input.publishedAt,
    durationSeconds: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    views: buildViews(input),
    transcript,
    addresses: extractAddresses(searchable),
    cashtags: extractCashtags(searchable),
    links: extractLinks(searchable),
    lexicon,
    provenance: input.provenance,
  };
}

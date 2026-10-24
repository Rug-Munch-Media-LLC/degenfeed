/**
 * @degenfeed/youtube-provider — ingest record types.
 *
 * Every record carries fetch provenance (source URL + fetch time) so a shill
 * candidate can always be re-read at the exact page it came from.
 */

export type ChainFamily = 'evm' | 'solana' | 'bitcoin' | 'unknown';

export interface DetectedAddress {
  address: string;
  chain: ChainFamily;
}

export interface DetectedLink {
  url: string;
  host: string;
}

export type LexiconStrength = 'low' | 'medium' | 'high';
export type LexiconField = 'title' | 'description' | 'transcript';

export interface LexiconHit {
  term: string;
  family: string;
  strength: LexiconStrength;
  field: LexiconField;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

/** `disabled` = uploader turned captions off; `not_requested` = we never asked. */
export type TranscriptStatus = 'available' | 'disabled' | 'not_requested' | 'error';

export interface Transcript {
  status: TranscriptStatus;
  language: string | null;
  segments: TranscriptSegment[];
  reason: string | null;
}

export interface FetchProvenance {
  sourceUrl: string;
  fetchedAt: string;
  method: 'rss' | 'yt-dlp' | 'fixture';
}

export interface ViewsSnapshot {
  at: string;
  views: number;
}

/** yt-dlp JSON subset we consume (metadata only — never media). */
export interface YtDlpMetadata {
  id: string;
  channel_id: string | null;
  channel: string | null;
  title: string | null;
  description: string | null;
  duration: number | null;
  view_count: number | null;
  upload_date: string | null;
}

export interface VideoRecord {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
  views: ViewsSnapshot[];
  transcript: Transcript;
  addresses: DetectedAddress[];
  cashtags: string[];
  links: DetectedLink[];
  lexicon: LexiconHit[];
  provenance: FetchProvenance;
}

/**
 * A normalised lead for the scam-proof lane. NOT a verdict — the lane that
 * consumes this decides. `status` is always `candidate`.
 */
export interface ShillCandidate {
  id: string;
  videoId: string;
  channelId: string;
  address: string;
  chain: ChainFamily;
  claim: string;
  quote: string;
  timestampMs: number | null;
  field: LexiconField;
  publishedAt: string;
  status: 'candidate';
  provenance: FetchProvenance;
}

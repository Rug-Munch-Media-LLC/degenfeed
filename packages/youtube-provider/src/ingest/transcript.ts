/**
 * Transcript normalisation (VTT, as emitted by yt-dlp `--write-auto-subs`).
 *
 * Policy: user-requested/author-published captions only; no media download and no
 * caption redistribution beyond analysis. When captions are missing we return an
 * explicit `disabled`/`error` status instead of inventing text, and the record is
 * kept metadata-only so a later retry can fill it in.
 */
import type { Transcript, TranscriptSegment } from './types';

const TIMESTAMP_RE =
  /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

function toMs(hours: string | undefined, minutes: string, seconds: string, millis: string): number {
  const h = hours ? Number.parseInt(hours, 10) : 0;
  const m = Number.parseInt(minutes, 10);
  const s = Number.parseInt(seconds, 10);
  const ms = Number.parseInt(millis, 10);
  return ((h * 60 + m) * 60 + s) * 1000 + ms;
}

/**
 * Parse a WebVTT body into timestamped segments.
 * Returns an empty array for input with no cues (caller decides the status).
 */
export function parseVtt(vtt: string): TranscriptSegment[] {
  const lines = vtt.replace(/\r\n/g, '\n').split('\n');
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const line of lines) {
    const match = TIMESTAMP_RE.exec(line.trim());
    if (match) {
      current = {
        startMs: toMs(match[1], match[2] ?? '0', match[3] ?? '0', match[4] ?? '0'),
        endMs: toMs(match[5], match[6] ?? '0', match[7] ?? '0', match[8] ?? '0'),
        text: '',
      };
      segments.push(current);
      continue;
    }
    if (!current) continue;
    const text = line.replace(/<[^>]+>/g, '').trim();
    if (!text) {
      current = null;
      continue;
    }
    current.text = current.text ? `${current.text} ${text}` : text;
  }
  return segments.filter((segment) => segment.text.length > 0);
}

/** Build a Transcript value. `null`/empty input means we got nothing usable. */
export function normalizeTranscript(
  vtt: string | null,
  language: string | null,
  failure: 'disabled' | 'error' | null = null,
): Transcript {
  if (failure) {
    return {
      status: failure,
      language,
      segments: [],
      reason: failure === 'disabled' ? 'subtitles_disabled_by_uploader' : 'fetch_failed',
    };
  }
  const segments = vtt ? parseVtt(vtt) : [];
  if (segments.length === 0) {
    return {
      status: 'disabled',
      language,
      segments: [],
      reason: 'no_caption_cues',
    };
  }
  return { status: 'available', language, segments: segments, reason: null };
}

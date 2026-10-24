import { describe, expect, it } from 'vitest';
import { CAPTIONS_VTT } from '../ingest/__fixtures__/captions';
import { normalizeTranscript, parseVtt } from '../ingest/transcript';

const vtt = CAPTIONS_VTT;

describe('transcript parsing', () => {
  it('parses cues with millisecond timestamps', () => {
    const segments = parseVtt(vtt);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({
      startMs: 4000,
      endMs: 9500,
      text: 'Welcome back. Today we look at the launch.',
    });
    expect(segments[1]?.startMs).toBe(62_250);
    expect(segments[1]?.text).toContain('0x1111');
  });

  it('strips inline markup and joins wrapped caption lines', () => {
    const segments = parseVtt(
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Speaker>hello</v>\nworld\n',
    );
    expect(segments).toEqual([{ startMs: 1000, endMs: 2000, text: 'hello world' }]);
  });
});

describe('transcript fallback', () => {
  it('reports uploader-disabled captions explicitly', () => {
    const transcript = normalizeTranscript(null, null, 'disabled');
    expect(transcript.status).toBe('disabled');
    expect(transcript.reason).toBe('subtitles_disabled_by_uploader');
    expect(transcript.segments).toEqual([]);
  });

  it('reports an empty caption body as unavailable, never fabricates text', () => {
    const transcript = normalizeTranscript('WEBVTT\n\n', 'en');
    expect(transcript.status).toBe('disabled');
    expect(transcript.reason).toBe('no_caption_cues');
  });

  it('reports fetch failures distinctly from disabled captions', () => {
    expect(normalizeTranscript(null, 'en', 'error').reason).toBe('fetch_failed');
  });
});

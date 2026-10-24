import { describe, expect, it } from 'vitest';
import { CAPTIONS_VTT } from '../ingest/__fixtures__/captions';
import { METADATA_FIXTURE } from '../ingest/__fixtures__/metadata';
import { buildVideoRecord } from '../ingest/record';
import { buildShillCandidates } from '../ingest/shill';
import { normalizeTranscript } from '../ingest/transcript';

const metadata = METADATA_FIXTURE;
const vtt = CAPTIONS_VTT;

const EVM = '0x1111111111111111111111111111111111111111';
const SOL = '4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw';

function record() {
  return buildVideoRecord({
    videoId: 'aBcDeFgHiJk',
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    channelName: 'Coin Bureau',
    title: 'rss title',
    description: 'rss description',
    publishedAt: '2026-10-20T12:00:00.000Z',
    rssDurationSeconds: 800,
    rssViews: 1000,
    metadata,
    transcript: normalizeTranscript(vtt, 'en'),
    provenance: {
      sourceUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw',
      fetchedAt: '2026-10-25T00:00:00.000Z',
      method: 'yt-dlp',
    },
  });
}

describe('video record', () => {
  it('prefers yt-dlp metadata and keeps provenance', () => {
    const built = record();
    expect(built.title).toBe(metadata.title);
    expect(built.durationSeconds).toBe(845);
    expect(built.views).toEqual([{ at: '2026-10-25T00:00:00.000Z', views: 128000 }]);
    expect(built.provenance.sourceUrl).toContain('feeds/videos.xml');
    expect(built.provenance.method).toBe('yt-dlp');
  });

  it('extracts addresses, cashtags and lexicon from description + transcript', () => {
    const built = record();
    expect(built.addresses.map((entry) => entry.address)).toEqual([EVM, SOL]);
    expect(built.cashtags).toContain('PEPE');
    expect(built.lexicon.map((hit) => hit.term)).toContain('presale');
    expect(built.links.some((link) => link.host === 'example.com')).toBe(true);
  });

  it('keeps the record metadata-only when captions are disabled', () => {
    const built = buildVideoRecord({
      videoId: 'noSubs01',
      channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
      channelName: 'Coin Bureau',
      title: 'no captions',
      description: 'presale',
      publishedAt: '2026-10-20T12:00:00.000Z',
      transcript: normalizeTranscript(null, null, 'disabled'),
      provenance: {
        sourceUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw',
        fetchedAt: '2026-10-25T00:00:00.000Z',
        method: 'rss',
      },
    });
    expect(built.transcript.status).toBe('disabled');
    expect(built.transcript.segments).toEqual([]);
    expect(built.lexicon.some((hit) => hit.term === 'presale')).toBe(true);
  });
});

describe('shill candidates', () => {
  it('emits one candidate per address with quote and timestamp, never a verdict', () => {
    const candidates = buildShillCandidates(record());
    expect(candidates).toHaveLength(2);
    const evm = candidates.find((candidate) => candidate.address === EVM);
    expect(evm?.timestampMs).toBe(62_250);
    expect(evm?.field).toBe('transcript');
    expect(evm?.quote).toContain(EVM);
    expect(evm?.claim).toBe('presale');
    expect(evm?.status).toBe('candidate');

    const sol = candidates.find((candidate) => candidate.address === SOL);
    expect(sol?.timestampMs).toBeNull();
    expect(sol?.field).toBe('description');
    expect(sol?.id).toBe(`aBcDeFgHiJk:${SOL}`);
  });
});

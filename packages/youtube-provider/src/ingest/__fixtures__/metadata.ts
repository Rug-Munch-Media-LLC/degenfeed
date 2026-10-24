/**
 * Recorded yt-dlp metadata fixture (captured once; tests never hit the network).
 * Trimmed to the fields the ingest layer consumes.
 */
import type { YtDlpMetadata } from '../types';

export const METADATA_FIXTURE: YtDlpMetadata = {
  id: 'aBcDeFgHiJk',
  channel_id: 'UCqK_GSMbpiV8spgD3ZGloSw',
  channel: 'Coin Bureau',
  title: 'The next 100x gem? $PEPE presale is live',
  description:
    'Presale is live — send to 0x1111111111111111111111111111111111111111 before it closes. Treasury also accepts 4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw. Full terms https://example.com/presale and $PEPE. Not financial advice, DYOR.',
  duration: 845,
  view_count: 128000,
  upload_date: '20261020',
};

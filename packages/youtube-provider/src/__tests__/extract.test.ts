import { describe, expect, it } from 'vitest';
import {
  extractAddresses,
  extractCashtags,
  extractLinks,
  scanLexicon,
  strongestHit,
} from '../ingest/extract';

const EVM = '0x1111111111111111111111111111111111111111';
const SOL = '4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw';
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

describe('address extraction', () => {
  it('detects EVM, Solana and Bitcoin shapes with the right chain', () => {
    const found = extractAddresses(`send to ${EVM} or ${SOL} or ${BTC}`);
    expect(found).toEqual([
      { address: EVM, chain: 'evm' },
      { address: BTC, chain: 'bitcoin' },
      { address: SOL, chain: 'solana' },
    ]);
  });

  it('does not mistake ordinary prose for a Solana key', () => {
    const prose = 'ThisIsALongCamelCaseSentenceThatIsNotAWalletAtAllReallyTruly';
    expect(extractAddresses(prose)).toEqual([]);
  });

  it('de-duplicates repeated addresses', () => {
    expect(extractAddresses(`${EVM} and again ${EVM}`)).toHaveLength(1);
  });
});

describe('cashtag extraction', () => {
  it('uppercases and de-duplicates, and ignores money amounts', () => {
    expect(extractCashtags('$pepe $SOL $pepe costs $100')).toEqual(['PEPE', 'SOL']);
  });
});

describe('link extraction', () => {
  it('keeps hosts and strips trailing punctuation', () => {
    const links = extractLinks('see https://example.com/presale. and https://t.me/join');
    expect(links).toEqual([
      { url: 'https://example.com/presale', host: 'example.com' },
      { url: 'https://t.me/join', host: 't.me' },
    ]);
  });
});

describe('promo lexicon', () => {
  it('flags high-strength guarantee language', () => {
    const hits = scanLexicon('guaranteed 100x, act fast', 'description');
    expect(hits.map((hit) => hit.term)).toContain('100x');
    expect(strongestHit(hits)?.strength).toBe('high');
  });

  it('returns nothing for neutral text', () => {
    expect(scanLexicon('an on-chain data tutorial', 'description')).toEqual([]);
  });
});

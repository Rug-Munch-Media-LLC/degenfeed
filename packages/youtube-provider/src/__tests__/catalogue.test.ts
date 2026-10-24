import { describe, expect, it } from 'vitest';
import { CURATED_ROWS } from '../catalogue/data';
import { buildCatalogue, buildDefaultCatalogue, normaliseKey } from '../catalogue/index';
import { parseRows } from '../catalogue/parse';
import { CRYPTO_CHANNELS } from '../youtube/config';

const curated = () =>
  parseRows(CURATED_ROWS, { selectedAt: '2026-10-25', source: 'curated-manual' });

describe('channel catalogue', () => {
  it('parses every curated row and rejects nothing silently', () => {
    const rows = curated();
    expect(rows.length).toBeGreaterThanOrEqual(250);
    for (const row of rows) {
      expect(row.handle).toBeTruthy();
      expect(row.weight).toBeGreaterThan(0);
      expect(row.weight).toBeLessThanOrEqual(1);
      expect(row.provenance.selectedAt).toBe('2026-10-25');
      expect(['socialblade-crypto', 'curated-manual']).toContain(row.provenance.source);
    }
  });

  it('has no duplicate handles or display names inside the curated list', () => {
    const rows = curated();
    const handles = rows.map((row) => normaliseKey(row.handle ?? ''));
    expect(new Set(handles).size).toBe(handles.length);
  });

  it('merges existing config without duplicating it', () => {
    const catalogue = buildDefaultCatalogue();
    for (const existing of CRYPTO_CHANNELS) {
      const hits = catalogue.entries.filter(
        (entry) =>
          entry.channelId === existing.channelId ||
          normaliseKey(entry.name) === normaliseKey(existing.name),
      );
      expect(hits).toHaveLength(1);
      expect(hits[0]?.channelId).toBe(existing.channelId);
    }
    expect(catalogue.duplicatesDropped).toBeGreaterThan(0);
  });

  it('keeps channel_id unique and never keys on a handle', () => {
    const catalogue = buildDefaultCatalogue();
    const ids = catalogue.entries
      .map((entry) => entry.channelId)
      .filter((id): id is string => !!id);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = catalogue.entries
      .map((entry) => entry.handle)
      .filter((handle): handle is string => !!handle)
      .map(normaliseKey);
    expect(new Set(handles).size).toBe(handles.length);
    expect(catalogue.pendingIds).toBe(
      catalogue.entries.filter((entry) => entry.channelId === null).length,
    );
  });

  it('records provenance for every entry', () => {
    const catalogue = buildDefaultCatalogue();
    for (const entry of catalogue.entries) {
      expect(entry.provenance.source).toBeTruthy();
      expect(entry.channelId !== null || entry.handle !== null).toBe(true);
    }
  });

  it('drops a row that repeats an earlier channel by id or name', () => {
    const rows = parseRows(
      '@dupchannel|Dup Channel|trading|technical-analysis|0.5|10|curated-manual\n@dupchannel|Dup Channel Two|trading|swing-trading|0.5|10|curated-manual',
      { selectedAt: '2026-10-25', source: 'curated-manual' },
    );
    const catalogue = buildCatalogue({ curated: rows, existing: [] });
    expect(catalogue.entries).toHaveLength(1);
    expect(catalogue.duplicatesDropped).toBe(1);
  });
});

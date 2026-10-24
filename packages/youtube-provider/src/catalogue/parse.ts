/** Catalogue row parsing (CSV-ish pipe format) with hard validation. */
import { CATEGORY_SET, SUBCATEGORY_SET } from './schema';
import type { CatalogueEntry } from './types';

export const ROW_FIELDS = 7;

export interface ParseOptions {
  selectedAt: string;
  source: CatalogueEntry['provenance']['source'];
}

/** Parse `handle|name|category|subcategory|weight|subsK|source` lines. */
export function parseRows(raw: string, options: ParseOptions): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cells = trimmed.split('|').map((cell) => cell.trim());
    if (cells.length !== ROW_FIELDS) {
      throw new Error(`catalogue row needs ${ROW_FIELDS} cells: ${trimmed}`);
    }
    const [handle, name, category, subcategory, weight, subsK, source] = cells;
    if (!handle || !name || !category || !subcategory || !weight) {
      throw new Error(`catalogue row has empty required cells: ${trimmed}`);
    }
    if (!CATEGORY_SET.has(category)) throw new Error(`unknown category "${category}"`);
    if (!SUBCATEGORY_SET.has(subcategory)) throw new Error(`unknown subcategory "${subcategory}"`);
    const numericWeight = Number.parseFloat(weight);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0 || numericWeight > 1) {
      throw new Error(`weight out of range (0,1]: ${trimmed}`);
    }
    const subscribers = subsK ? Number.parseFloat(subsK) : Number.NaN;
    entries.push({
      channelId: null,
      handle,
      name,
      category: category as CatalogueEntry['category'],
      subcategory: subcategory as CatalogueEntry['subcategory'],
      weight: numericWeight,
      niches: [category, subcategory],
      provenance: {
        source: (source || options.source) as CatalogueEntry['provenance']['source'],
        selectedAt: options.selectedAt,
        rank: entries.length + 1,
        ...(Number.isFinite(subscribers)
          ? { approxSubscribers: Math.round(subscribers * 1000) }
          : {}),
      },
    });
  }
  return entries;
}

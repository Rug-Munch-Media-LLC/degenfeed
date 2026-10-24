/** Catalogue shapes. The stable key is the YouTube channel_id; handles are provisional. */
import type { ChannelCategory, ChannelSubcategory } from '../youtube/types';

export type CatalogueSource =
  | 'existing-config'
  | 'curated-manual'
  | 'socialblade-crypto'
  | 'rss-curated'
  | 'manual-2026';

export interface CatalogueProvenance {
  /** How this channel got on the list (ranking source / curation method). */
  source: CatalogueSource;
  /** ISO date of selection; null for channels inherited from existing config. */
  selectedAt: string | null;
  /** Position in the curated ordering (1 = highest priority). */
  rank?: number;
  approxSubscribers?: number;
  note?: string;
}

export interface CatalogueEntry {
  /** YouTube channel id (`UC…`) once resolved; null while handle-only. */
  channelId: string | null;
  handle: string | null;
  name: string;
  category: ChannelCategory;
  subcategory: ChannelSubcategory;
  weight: number;
  niches: string[];
  provenance: CatalogueProvenance;
}

export interface Catalogue {
  entries: CatalogueEntry[];
  duplicatesDropped: number;
  pendingIds: number;
}

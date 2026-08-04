/**
 * @degenfeed/web — feed protocol configuration
 *
 * Re-export of the canonical protocol registry from @degenfeed/utils.
 * The registry (PROTOCOLS, EXTRA_PROTOCOLS, categories, colors, labels,
 * icons) lives in packages/utils/src/protocols.ts — this file exists so
 * existing app imports keep working.
 *
 * Add/change protocols in packages/utils/src/protocols.ts, not here.
 */

export type {
  ExtraProtocolConfig,
  ProtocolCategory,
  ProtocolConfig,
} from '@degenfeed/utils';

export {
  CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_PROTOCOLS,
  EXTRA_PROTOCOLS,
  PROTOCOL_LIST,
  PROTOCOLS,
  SIDEBAR_ORDER,
} from '@degenfeed/utils';

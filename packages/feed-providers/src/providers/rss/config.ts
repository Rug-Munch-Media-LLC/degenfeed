// ── RSS source catalogue ───────────────────────────────────────────
// Data-only modules: each chunk is a verbatim slice of the historical
// single-file catalogue, concatenated here in original order.

import { FEEDS_01 } from './config/feeds-01';
import { FEEDS_02 } from './config/feeds-02';
import { FEEDS_03 } from './config/feeds-03';
import { FEEDS_04 } from './config/feeds-04';
import { FEEDS_05 } from './config/feeds-05';
import { FEEDS_06 } from './config/feeds-06';
import { FEEDS_07 } from './config/feeds-07';
import { FEEDS_08 } from './config/feeds-08';
import { FEEDS_09 } from './config/feeds-09';
import { FEEDS_10 } from './config/feeds-10';
import { FEEDS_11 } from './config/feeds-11';
import { FEEDS_12 } from './config/feeds-12';
import { FEEDS_13 } from './config/feeds-13';
import { FEEDS_14 } from './config/feeds-14';
import { FEEDS_15 } from './config/feeds-15';
import { FEEDS_16 } from './config/feeds-16';
import { FEEDS_17 } from './config/feeds-17';
import type { RssFeedConfig } from './types';

export const DEFAULT_CRYPTO_FEEDS: RssFeedConfig[] = [
  ...FEEDS_01,
  ...FEEDS_02,
  ...FEEDS_03,
  ...FEEDS_04,
  ...FEEDS_05,
  ...FEEDS_06,
  ...FEEDS_07,
  ...FEEDS_08,
  ...FEEDS_09,
  ...FEEDS_10,
  ...FEEDS_11,
  ...FEEDS_12,
  ...FEEDS_13,
  ...FEEDS_14,
  ...FEEDS_15,
  ...FEEDS_16,
  ...FEEDS_17,
];

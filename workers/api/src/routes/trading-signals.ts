/**
 * @degenfeed/api-worker — Social Trading Signals
 *
 * Real-time social trading feed showing buy/sell activity across
 * creator coins, trending coins by social volume, and whale movements.
 *
 * KV keys:
 *   trading:signals              → TradingSignal[] (ring buffer, capped at 500)
 *   trading:trending             → TrendingCoin[] (top 50 by social volume)
 *   trading:whales               → WhaleWatchEntry[] (whale watchlist)
 *   trading:signals:{coin}       → TradingSignal[] per coin (capped at 100)
 *   trading:last-updated:signals → ISO timestamp
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type TradingSignalType = 'buy' | 'sell' | 'launch' | 'whale_movement' | 'social_spike';

export type TradingSignal = {}

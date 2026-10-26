import thresholds from './config/dedup-thresholds.json';

/**
 * Jaccard similarity at or above which two posts are treated as near-duplicates.
 * The value lives in config/dedup-thresholds.json (data seam); this module loads
 * it once so no threshold literal is embedded in scoring code.
 */
export const JACCARD_THRESHOLD: number = thresholds.jaccardSimilarity;

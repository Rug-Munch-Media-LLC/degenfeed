// ─── Post domain extraction ───────────────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';
import { primaryUrl } from './url-identity';

export function extractDomain(post: UnifiedPost): string | null {
  const url = primaryUrl(post);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

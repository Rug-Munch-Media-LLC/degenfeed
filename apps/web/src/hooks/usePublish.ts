'use client';

import { useCallback } from 'react';
import { useToast } from '../components/Toast';

/**
 * Hook providing a publish function that POSTs to /api/publish and surfaces
 * per-protocol results via toast notifications. Extracted from AuthProvider
 * to reduce monolith size.
 */
export function usePublish(tokens: Record<string, string>) {
  const { showToast } = useToast();

  const publish = useCallback(
    async (
      text: string,
      targets: string[],
      opts?: { lensCollect?: boolean },
    ): Promise<Record<string, { ok: boolean; error?: string }>> => {
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, targets, auth: tokens, lensCollect: opts?.lensCollect }),
        });
        const data = await res.json();
        const results: Record<string, { ok: boolean; error?: string }> = data.results ?? {};

        // Show toast with per-protocol results
        const ok = targets.filter((t) => results[t]?.ok);
        const failed = targets.filter((t) => !results[t]?.ok);
        if (ok.length > 0 && failed.length === 0) {
          showToast('success', `Posted to ${ok.length} network${ok.length > 1 ? 's' : ''} ✅`);
        } else if (ok.length > 0 && failed.length > 0) {
          const failedLabels = failed.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
          showToast(
            'warning',
            `Posted to ${ok.length} network${ok.length > 1 ? 's' : ''}, ${failed.length} failed (${failedLabels})`,
          );
        } else {
          const firstError = failed[0] ? results[failed[0]]?.error : '';
          showToast('error', `Publish failed: ${firstError || 'All networks returned errors'}`);
        }

        return results;
      } catch {
        const results: Record<string, { ok: boolean; error?: string }> = {};
        for (const t of targets) results[t] = { ok: false, error: 'Network error' };
        return results;
      }
    },
    [tokens, showToast],
  );

  return publish;
}

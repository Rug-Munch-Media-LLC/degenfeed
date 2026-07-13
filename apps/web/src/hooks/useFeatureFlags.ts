'use client';

import { useCallback, useEffect, useState } from 'react';

interface FeatureFlagsResponse {
  flags: Array<{ key: string; enabled: boolean }>;
  enabled: Record<string, boolean>;
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/features', { cache: 'no-store' });
        const data = (await res.json()) as FeatureFlagsResponse;
        if (!cancelled) {
          setFlags(data.enabled || {});
        }
      } catch {
        if (!cancelled) setFlags({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isEnabled = useCallback(
    (key: string): boolean => {
      return flags[key] === true;
    },
    [flags],
  );

  return { flags, loading, isEnabled };
}

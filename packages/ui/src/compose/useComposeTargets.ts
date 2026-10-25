'use client';

/**
 * @degenfeed/ui — per-protocol selection state for the composer.
 *
 * Owns which networks the draft targets: initial selection from the signed-in
 * map, connection sync, pre-selection, and the toggle behaviour that asks the
 * host to open sign-in for unconnected protocols.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { COMPOSE_TARGETS, type ComposeTarget } from './types';

export interface UseComposeTargetsArgs {
  open: boolean;
  signedInProtocols: Record<string, boolean>;
  preselectProtocols?: string[];
  onRequestSignIn?: (id: string) => void;
}

export interface UseComposeTargets {
  targets: ComposeTarget[];
  setTargets: React.Dispatch<React.SetStateAction<ComposeTarget[]>>;
  toggleTarget: (id: string) => void;
  selectedTargets: string[];
  selectedCount: number;
}

export function useComposeTargets({
  open,
  signedInProtocols,
  preselectProtocols,
  onRequestSignIn,
}: UseComposeTargetsArgs): UseComposeTargets {
  const [targets, setTargets] = useState<ComposeTarget[]>(() =>
    COMPOSE_TARGETS.map((t) => ({
      ...t,
      enabled: !!signedInProtocols[t.id],
      connected: !!signedInProtocols[t.id],
      status: 'idle' as const,
    })),
  );

  useEffect(() => {
    setTargets((prev) => prev.map((t) => ({ ...t, connected: !!signedInProtocols[t.id] })));
  }, [signedInProtocols]);

  useEffect(() => {
    if (!open || !preselectProtocols || preselectProtocols.length === 0) return;
    setTargets((prev) =>
      prev.map((t) =>
        preselectProtocols.includes(t.id) ? { ...t, enabled: true, connected: true } : t,
      ),
    );
  }, [open, preselectProtocols]);

  const toggleTarget = useCallback(
    (id: string) => {
      setTargets((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          if (!t.connected) {
            onRequestSignIn?.(id);
            return t;
          }
          return { ...t, enabled: !t.enabled };
        }),
      );
    },
    [onRequestSignIn],
  );

  const selectedTargets = useMemo(
    () => targets.filter((t) => t.enabled).map((t) => t.id),
    [targets],
  );

  return {
    targets,
    setTargets,
    toggleTarget,
    selectedTargets,
    selectedCount: selectedTargets.length,
  };
}

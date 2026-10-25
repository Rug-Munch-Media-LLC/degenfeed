'use client';

/**
 * @degenfeed/ui — draft autosave and restore for the composer.
 *
 * Restores the last draft (or a prefill) when the dialog opens, then autosaves
 * the working draft 500ms after the last edit. Storage failures are ignored:
 * a private-mode browser still gets a working composer.
 */

import { useEffect } from 'react';
import { loadDraft, saveDraft } from '../ComposeDraftManager';

export interface UseDraftPersistenceArgs {
  open: boolean;
  text: string;
  enabledTargets: Record<string, boolean>;
  attachedImages: string[];
  prefillText?: string;
  restore: (text: string) => void;
  reset: () => void;
}

export function useDraftPersistence({
  open,
  text,
  enabledTargets,
  attachedImages,
  prefillText,
  restore,
  reset,
}: UseDraftPersistenceArgs): void {
  // Restore on open (or apply a translation prefill) and reset ephemeral state.
  useEffect(() => {
    if (!open) return;
    if (prefillText) {
      restore(prefillText);
    } else {
      try {
        const saved = loadDraft();
        if (saved?.text) restore(saved.text);
      } catch {
        /* storage unavailable */
      }
    }
    reset();
    setTimeout(() => document.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 100);
  }, [open, prefillText, restore, reset]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      try {
        saveDraft({ text, enabledTargets, attachedImages, timestamp: Date.now() });
      } catch {
        /* storage unavailable */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [text, open, enabledTargets, attachedImages]);
}

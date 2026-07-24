/**
 * Draft management for ComposeModal — localStorage save/load/clear.
 */

const DRAFT_KEY = 'degenfeed_compose_draft';

export interface ComposeDraft {
  text: string;
  enabledTargets: Record<string, boolean>;
  attachedImages: string[];
  timestamp: number;
}

export function saveDraft(draft: ComposeDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable
  }
}

export function loadDraft(): ComposeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ComposeDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

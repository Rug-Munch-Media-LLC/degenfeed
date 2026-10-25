/**
 * @degenfeed/ui — compose validation.
 *
 * Pure rules for "can this draft be published": non-empty text, at least one
 * enabled protocol, and no enabled protocol over its character limit.
 */

import { type ComposeTarget, MAX_CHARS } from './types';

export type ComposeBlockReason = 'empty' | 'no-targets' | 'over-limit' | 'too-long' | 'publishing';

export interface ComposeValidation {
  canSubmit: boolean;
  reason?: ComposeBlockReason;
  overLimitIds: string[];
  selectedCount: number;
  anyFailed: boolean;
}

export function validateCompose(
  text: string,
  targets: ComposeTarget[],
  publishing = false,
): ComposeValidation {
  const enabled = targets.filter((t) => t.enabled);
  const overLimitIds = enabled.filter((t) => text.length > t.charLimit).map((t) => t.id);
  const base = {
    overLimitIds,
    selectedCount: enabled.length,
    anyFailed: targets.some((t) => t.status === 'failed'),
  };

  if (!text.trim()) return { ...base, canSubmit: false, reason: 'empty' };
  if (enabled.length === 0) return { ...base, canSubmit: false, reason: 'no-targets' };
  if (overLimitIds.length > 0) return { ...base, canSubmit: false, reason: 'over-limit' };
  if (text.length > MAX_CHARS) return { ...base, canSubmit: false, reason: 'too-long' };
  if (publishing) return { ...base, canSubmit: false, reason: 'publishing' };
  return { ...base, canSubmit: true };
}

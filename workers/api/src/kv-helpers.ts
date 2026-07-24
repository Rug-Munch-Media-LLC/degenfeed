/**
 * @degenfeed/api-worker — Shared KV key helpers for space-related storage.
 *
 * Extracted from discover.ts and spaces.ts to eliminate duplication.
 */

export function liveIndexKey(): string {
  return 'spaces:live';
}

export function upcomingIndexKey(): string {
  return 'spaces:upcoming';
}

export function spaceKey(id: string): string {
  return `spaces:${id}`;
}

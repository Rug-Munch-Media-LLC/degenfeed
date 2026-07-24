/* === Types for /profile/data page === */

export interface ExportState {
  status: 'idle' | 'collecting' | 'downloading' | 'done' | 'error';
  message?: string;
}

export interface CredentialExportState {
  status: 'idle' | 'preparing' | 'downloading' | 'done' | 'error';
  message?: string;
}

export interface DeleteState {
  status: 'idle' | 'confirming' | 'deleting' | 'done' | 'error';
  message?: string;
}

export type DataCategory =
  | 'identities'
  | 'bookmarks'
  | 'follows'
  | 'muted'
  | 'mutedWords'
  | 'blocked'
  | 'mutedCommunities'
  | 'blockedCommunities'
  | 'preferences';

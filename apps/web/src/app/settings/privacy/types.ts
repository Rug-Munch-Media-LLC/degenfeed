export interface DataInventoryItem {
  category: string;
  description: string;
  stored: boolean;
  retentionDays: number;
  canBeDeleted: boolean;
  icon: string;
}

export interface ThirdPartyConnection {
  protocol: string;
  connected: boolean;
  handle?: string;
  dataShared: string[];
  lastSync?: string;
  icon?: string;
}

export interface ExportFormat {
  id: string;
  label: string;
  description: string;
  icon: string;
  mimeType: string;
}

export interface MigrationPlatform {
  id: string;
  label: string;
  icon: string;
  direction: 'import' | 'export' | 'both';
}

export interface DeleteStatus {
  pending: boolean;
  recoverableUntil?: string;
  message?: string;
}

export interface BackendUsage {
  bytes: number;
  readable: string;
  count: number;
  costPerMo?: number;
  label?: string;
  emoji?: string;
}

export interface TypeUsage {
  bytes: number;
  readable: string;
  count: number;
  backend?: string;
  tier?: string;
  costPerMo?: number;
}

export interface ExpiringVideo {
  contentId: string;
  title?: string;
  expiresAt: number;
  daysLeft: number;
  tier?: string;
  size?: number;
}

export interface StorageForecast {
  projectedBytes30d: number;
  projectedBytes90d: number;
  currentMonthlyCost: number;
  projectedMonthlyCost30d: number;
  projectedMonthlyCost90d: number;
  daysUntilFull: number | null;
  recommendation: string;
  currentBytes?: number;
}

export interface StorageUsageData {
  totalBytes: number;
  totalReadable: string;
  freeLimit: number;
  usagePercent: number;
  byBackend: Record<string, BackendUsage>;
  byType: Record<string, TypeUsage>;
  plan: 'free' | 'premium' | 'pro' | 'enterprise';
  expiringSoon: ExpiringVideo[];
  costBreakdown?: Record<string, number>;
  totalMonthlyCost?: number;
  forecast?: StorageForecast;
  migrationCandidates?: number;
  potentialSavings?: number;
}

export interface StorageTier {
  id: string;
  name: string;
  price: string;
  storage: string;
  backends: string;
  features: string[];
  popular?: boolean;
  cta: string;
  color: string;
}

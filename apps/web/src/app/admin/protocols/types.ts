export interface ProtocolInstance {
  id: string;
  name: string;
  icon: string;
  status: 'online' | 'degraded' | 'offline';
  version: string;
  health: number;
  users24h: number;
  posts24h: number;
  totalUsers: number;
  totalPosts: number;
  federationStatus: 'active' | 'partial' | 'inactive';
  lastSync: number;
  errorRate: number;
  avgLatency: number;
  lastError?: string;
  config: Record<string, string | number | boolean>;
  connectors: string[];
  enabled: boolean;
}

export interface ProtocolLog {
  id: string;
  protocolId: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

export interface AddProtocolWizard {
  step: number;
  name: string;
  icon: string;
  type: string;
  endpoint: string;
  apiKey: string;
}

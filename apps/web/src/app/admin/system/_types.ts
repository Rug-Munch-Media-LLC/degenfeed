// === Types ===
// Auto-extracted from page.tsx

export interface ServerResources {
  cpu: { model: string; cores: number; usage: number; temperature?: number };
  memory: { total: number; used: number; usagePercent: number };
  disk: { total: number; used: number; usagePercent: number; mount: string };
  network: { rxBytes: number; txBytes: number; uptime: number; connections: number };
  loadAverage: number[];
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'paused';
  ports: string;
  cpu: number;
  memory: number;
  uptime: number;
  restartCount: number;
}

export interface BackupItem {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'database' | 'config';
  size: string;
  status: 'completed' | 'running' | 'failed' | 'pending';
  target: string;
  startedAt: number;
  completedAt?: number;
  location: string;
}

export interface DnsSslEntry {
  domain: string;
  dnsStatus: 'resolved' | 'unresolved' | 'checking';
  sslStatus: 'valid' | 'expiring' | 'expired' | 'missing' | 'checking';
  sslExpiry?: number;
  issuer?: string;
  ip?: string;
}

export interface ServiceVersion {
  name: string;
  version: string;
  latestVersion?: string;
  status: 'up_to_date' | 'outdated' | 'unknown';
  category: 'core' | 'infrastructure' | 'protocol' | 'monitoring';
}

export interface SystemLog {
  id: string;
  service: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

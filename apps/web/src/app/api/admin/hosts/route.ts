import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../_auth';

export const runtime = 'nodejs';

// Host inventory is injected at deploy time via the ADMIN_HOSTS_JSON env var.
// Never hardcode internal topology (hostnames, IPs, ports) in this public repo.
// Expected shape: { "servers": ServerInfo[] } (see admin/hosts page for the type).

function loadServers(): unknown {
  const raw = process.env.ADMIN_HOSTS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { servers?: unknown };
      if (parsed.servers !== undefined) return parsed.servers;
    } catch {
      // Invalid env config — fall through to sanitized defaults.
    }
  }
  return DEFAULT_SERVERS;
}

// Sanitized fallback used only when ADMIN_HOSTS_JSON is not configured.
// Contains no internal topology.
const DEFAULT_SERVERS = [
  {
    id: 'host-1',
    name: 'Host 1',
    hostname: '[INTERNAL]',
    ip: '[INTERNAL]',
    provider: 'Internal',
    location: '—',
    cpu: { model: 'Generic', cores: 0, usage: 0 },
    memory: { total: 0, used: 0, usagePercent: 0 },
    disk: { total: 0, used: 0, usagePercent: 0 },
    network: { rxBytes: 0, txBytes: 0, uptime: 0 },
    services: [],
    containers: [],
    lastSeen: Math.floor(Date.now() / 1000),
    os: '—',
    kernel: '—',
  },
  {
    id: 'host-2',
    name: 'Host 2',
    hostname: '[INTERNAL]',
    ip: '[INTERNAL]',
    provider: 'Internal',
    location: '—',
    cpu: { model: 'Generic', cores: 0, usage: 0 },
    memory: { total: 0, used: 0, usagePercent: 0 },
    disk: { total: 0, used: 0, usagePercent: 0 },
    network: { rxBytes: 0, txBytes: 0, uptime: 0 },
    services: [],
    containers: [],
    lastSeen: Math.floor(Date.now() / 1000),
    os: '—',
    kernel: '—',
  },
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  return NextResponse.json(
    { servers: loadServers() },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../_auth';

export const runtime = 'nodejs';

// TODO: Wire to worker backend
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

const SERVERS = [
  {
    id: 'talos',
    name: 'Talos',
    hostname: 'talos.netcup.de',
    ip: '185.10.68.42',
    provider: 'Netcup',
    location: 'Nuremberg, DE',
    cpu: { model: 'AMD EPYC 7443P', cores: 8, usage: 34.2, temperature: 52 },
    memory: { total: 32768, used: 18432, usagePercent: 56.2 },
    disk: { total: 512, used: 283, usagePercent: 55.3 },
    network: { rxBytes: 1_450_000_000_000, txBytes: 820_000_000_000, uptime: 14 * DAY },
    services: [
      { name: 'Ollama', status: 'running' as const, port: 11434, cpu: 8.2, memory: 4096 },
      { name: 'FlareSolverr', status: 'running' as const, port: 8191, cpu: 2.1, memory: 512 },
      { name: 'Mastodon Fetcher', status: 'running' as const, port: 3003, cpu: 12.4, memory: 1024 },
      { name: 'Redis', status: 'running' as const, port: 6379, cpu: 0.8, memory: 64 },
      { name: 'PostgreSQL', status: 'running' as const, port: 5432, cpu: 3.5, memory: 2048 },
    ],
    containers: [
      {
        name: 'degenfeed-api',
        image: 'degenfeed/api:latest',
        status: 'running' as const,
        ports: '3000',
        cpu: 5.2,
        memory: 256,
      },
      {
        name: 'feed-worker',
        image: 'degenfeed/worker:latest',
        status: 'running' as const,
        cpu: 18.3,
        memory: 512,
      },
      {
        name: 'tip-indexer',
        image: 'degenfeed/tip-indexer:latest',
        status: 'running' as const,
        cpu: 1.4,
        memory: 128,
      },
      {
        name: 'postgres-15',
        image: 'postgres:15-alpine',
        status: 'running' as const,
        cpu: 2.8,
        memory: 1024,
      },
      {
        name: 'redis-stack',
        image: 'redis/redis-stack:latest',
        status: 'running' as const,
        cpu: 0.6,
        memory: 64,
      },
    ],
    lastSeen: NOW - 5,
    os: 'Ubuntu 24.04 LTS',
    kernel: '6.8.0-31-generic',
  },
  {
    id: 'hydra',
    name: 'Hydra',
    hostname: 'hydra.contabo.de',
    ip: '185.10.68.84',
    provider: 'Contabo',
    location: 'Munich, DE',
    cpu: { model: 'Intel Xeon Platinum 8358P', cores: 6, usage: 28.7, temperature: 48 },
    memory: { total: 24576, used: 15872, usagePercent: 64.6 },
    disk: { total: 400, used: 247, usagePercent: 61.8 },
    network: { rxBytes: 890_000_000_000, txBytes: 540_000_000_000, uptime: 21 * DAY },
    services: [
      { name: 'SearXNG', status: 'running' as const, port: 8089, cpu: 3.8, memory: 256 },
      { name: 'n8n', status: 'running' as const, port: 5678, cpu: 6.2, memory: 768 },
      { name: 'Ollama', status: 'running' as const, port: 11434, cpu: 4.5, memory: 2048 },
      { name: 'Nginx', status: 'running' as const, port: 80, cpu: 0.5, memory: 32 },
      { name: 'Prometheus', status: 'running' as const, port: 9090, cpu: 1.8, memory: 384 },
    ],
    containers: [
      {
        name: 'searxng',
        image: 'searxng/searxng:latest',
        status: 'running' as const,
        ports: '8089',
        cpu: 3.1,
        memory: 192,
      },
      {
        name: 'n8n-workflow',
        image: 'n8nio/n8n:latest',
        status: 'running' as const,
        ports: '5678',
        cpu: 5.4,
        memory: 512,
      },
      {
        name: 'grafana',
        image: 'grafana/grafana:latest',
        status: 'running' as const,
        ports: '3000',
        cpu: 2.2,
        memory: 256,
      },
      {
        name: 'prometheus',
        image: 'prom/prometheus:latest',
        status: 'running' as const,
        ports: '9090',
        cpu: 1.5,
        memory: 384,
      },
      {
        name: 'node-exporter',
        image: 'prom/node-exporter:latest',
        status: 'running' as const,
        cpu: 0.3,
        memory: 16,
      },
    ],
    lastSeen: NOW - 2,
    os: 'Ubuntu 24.04 LTS',
    kernel: '6.8.0-31-generic',
  },
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  return NextResponse.json(
    { servers: SERVERS },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}

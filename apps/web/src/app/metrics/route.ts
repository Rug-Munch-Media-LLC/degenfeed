import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  const metrics = [
    '# HELP degenfeed_uptime_seconds Process uptime',
    '# TYPE degenfeed_uptime_seconds gauge',
    `degenfeed_uptime_seconds ${uptime}`,
    '# HELP degenfeed_memory_bytes Process memory usage',
    '# TYPE degenfeed_memory_bytes gauge',
    `degenfeed_memory_bytes{type="heapUsed"} ${mem.heapUsed}`,
    `degenfeed_memory_bytes{type="heapTotal"} ${mem.heapTotal}`,
    `degenfeed_memory_bytes{type="rss"} ${mem.rss}`,
    '# HELP degenfeed_info Static build info',
    '# TYPE degenfeed_info gauge',
    'degenfeed_info{version="1.0.0",runtime="edge"} 1',
  ].join('\n');

  return new NextResponse(metrics, {
    headers: { 'Content-Type': 'text/plain; version=0.0.4' },
  });
}

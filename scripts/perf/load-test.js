import { check, group, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = __ENV.BASE_URL || 'https://degenfeed.xyz';

export default function () {
  group('health', () => {
    const r = http.get(`${BASE}/api/health`, { timeout: '10s' });
    check(r, { 'health 200': (r) => r.status === 200 });
  });

  group('feed', () => {
    const r = http.get(`${BASE}/api/feed/home?limit=10`, { timeout: '15s' });
    check(r, { 'feed 200': (r) => r.status === 200 });
  });

  group('landing', () => {
    const r = http.get(`${BASE}/`, { timeout: '10s' });
    check(r, { 'landing 200': (r) => r.status === 200 });
  });

  group('rss', () => {
    const r = http.get(`${BASE}/api/feed/rss.xml`, { timeout: '10s' });
    check(r, { 'rss 200 or 301': (r) => r.status === 200 || r.status === 301 });
  });

  sleep(1);
}

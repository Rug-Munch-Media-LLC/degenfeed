import type http from 'node:http';

export const ALLOWED_ORIGINS = [
  'https://app.degenfeed.xyz',
  'https://degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:3100',
];

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleSyncFeed(
  _path: string,
  _searchParams: URLSearchParams,
  _res: http.ServerResponse,
  _fetchAll: typeof import('./feeds').PROVIDERS[keyof typeof import('./feeds').PROVIDERS]['fetch'],
): Promise<void> {
  // This is handled in the main request handler
}

export { jsonOk };

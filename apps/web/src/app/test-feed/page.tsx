export const dynamic = 'force-dynamic';

export default async function TestFeedPage() {
  let nostr = 'no data';
  let farcaster = 'no data';
  try {
    const n = await fetch('http://degenfeed-api:3001/api/feed/nostr?limit=5', { signal: AbortSignal.timeout(5000) });
    const nj = await n.json();
    nostr = `nostr: ${nj.data?.length || 0} items — ${nj.data?.[0]?.text?.slice(0, 100) || 'no text'}`;
    
    const f = await fetch('http://degenfeed-api:3001/api/feed/farcaster?limit=5', { signal: AbortSignal.timeout(5000) });
    const fj = await f.json();
    farcaster = `farcaster: ${fj.data?.length || 0} items — ${fj.data?.[0]?.text?.slice(0, 100) || 'no text'}`;
  } catch (e: any) {
    nostr = `ERROR: ${e.message}`;
  }
  return React.createElement('pre', { style: { color: '#0f0', background: '#111', padding: 20, fontFamily: 'monospace' } }, nostr + '\n\n' + farcaster);
}

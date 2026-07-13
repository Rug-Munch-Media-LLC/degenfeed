export const runtime = 'edge';

export function GET() {
  return new Response(
    [
      '# DegenFeed security.txt',
      '',
      'Contact: mailto:admin@rugmunch.io',
      'Preferred-Languages: en',
      'Canonical: https://app.degenfeed.xyz/.well-known/security.txt',
      'Expires: 2027-07-08T00:00:00Z',
      '',
      '# Security policy: https://git.rugmunch.io/RugMunchMedia/degenfeed-web/raw/branch/main/SECURITY.md',
      '# PGP key available on request to security@degenfeed.xyz',
    ].join('\n'),
    {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  );
}

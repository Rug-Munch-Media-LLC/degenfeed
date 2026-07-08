import type { Metadata } from 'next';

export const runtime = 'edge';

export default function SecurityPage() {
  return new Response(
    [
      '# DegenFeed security.txt',
      '',
      'Contact: mailto:admin@rugmunch.io',
      'Preferred-Languages: en',
      'Canonical: https://app.degenfeed.xyz/.well-known/security.txt',
      'Expires: 2027-07-08T00:00:00Z',
      '',
      '# We accept vulnerability reports via email.',
      '# PGP key available at:',
      '# https://github.com/RugMunchMedia/degenfeed-web/security',
    ].join('\n'),
    {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  );
}

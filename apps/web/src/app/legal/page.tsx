import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Legal Notice — DegenFeed',
  description:
    'Legal notice, company information, and registered agent for DegenFeed, operated by Rug Munch Media LLC, a Wyoming limited liability company.',
  openGraph: {
    title: 'Legal Notice — DegenFeed | Rug Munch Media LLC',
    description:
      'Legal notice and company information for DegenFeed, operated by Rug Munch Media LLC.',
    url: 'https://app.degenfeed.xyz/legal',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Legal Notice — Rug Munch Media LLC',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal Notice — DegenFeed',
    description:
      'Legal notice and company information for DegenFeed, operated by Rug Munch Media LLC.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/legal' },
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[var(--color-muted)]">
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Legal Notice</h1>
      <p className="mb-8 text-lg text-degen-400">Rug Munch Media LLC</p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Company</h2>
      <p className="mb-4">
        DegenFeed is a product of Rug Munch Media LLC, a Wyoming limited liability company.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Registered Office</h2>
      <p className="mb-4">Registered in the State of Wyoming, United States of America.</p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Contact</h2>
      <ul className="mb-4 space-y-1">
        <li>
          General inquiries:{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
        </li>
        <li>
          Legal / law enforcement:{' '}
          <a href="mailto:legal@rugmunch.io" className="text-degen-400 underline">
            legal@rugmunch.io
          </a>
        </li>
      </ul>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">DMCA Agent</h2>
      <p className="mb-4">
        For copyright-related takedown requests:{' '}
        <a href="mailto:dmca@degenfeed.xyz" className="text-degen-400 underline">
          dmca@degenfeed.xyz
        </a>
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Data Protection Officer</h2>
      <p className="mb-4">
        For GDPR and data privacy inquiries:{' '}
        <a href="mailto:legal@rugmunch.io" className="text-degen-400 underline">
          legal@rugmunch.io
        </a>
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Disclaimer</h2>
      <p className="mb-4">
        DegenFeed is provided &ldquo;as is&rdquo; without warranty of any kind. DegenFeed is not a
        financial services platform. Nothing on DegenFeed constitutes financial advice. All
        trademarks and registered trademarks are the property of their respective owners.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Governing Law</h2>
      <p className="mb-4">
        These terms and your use of DegenFeed are governed by the laws of the State of Wyoming,
        United States, without regard to conflict of law principles.
      </p>
    </div>
  );
}

import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for DegenFeed, operated by Rug Munch Media LLC, a Wyoming limited liability company.',
  openGraph: {
    title: 'Terms of Service — DegenFeed',
    description: 'Terms of Service for DegenFeed.',
    url: 'https://app.degenfeed.xyz/terms',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Terms of Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — DegenFeed',
    description: 'Terms of Service for DegenFeed.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/terms' },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">Terms of Service</h1>
      <p className="mb-4 text-gray-500">Last updated: July 2026</p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">1. Acceptance</h2>
      <p className="mb-4">
        By using DegenFeed, you agree to these terms. If you do not agree, do not use the service.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">2. Eligibility</h2>
      <p className="mb-4">
        You must be at least 16 years old. If you are under 18, you need parental consent.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">3. Your Content</h2>
      <p className="mb-4">
        You own the content you post. By posting, you grant DegenFeed a limited license to display
        it in feeds and search results. DegenFeed does not claim ownership of your posts. DegenFeed
        is an aggregator — your posts live on the underlying protocols (Nostr, Farcaster, Lens,
        Bluesky, Mastodon). DegenFeed does not store or archive your content beyond what is
        necessary to display feeds.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">4. Acceptable Use</h2>
      <p className="mb-4">
        See our{' '}
        <a href="/acceptable-use" className="text-degen-400 underline">
          Acceptable Use Policy
        </a>
        .
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">5. DMCA Notice</h2>
      <p className="mb-4">
        If you believe content on DegenFeed infringes your copyright, send a DMCA notice to{' '}
        <a href="mailto:dmca@degenfeed.xyz" className="text-degen-400 underline">
          dmca@degenfeed.xyz
        </a>{' '}
        with: identification of the copyrighted work, the infringing URL, a statement of good faith
        belief, your contact information, and a physical or electronic signature. We respond to
        valid DMCA notices within 48 hours.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">6. Disclaimer</h2>
      <p className="mb-4">
        DegenFeed is provided &ldquo;as is&rdquo; without warranty. We are not responsible for
        content posted by third parties on connected networks. Content may include financial
        opinions — nothing on DegenFeed is financial advice.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">6. Limitation of Liability</h2>
      <p className="mb-4">
        To the fullest extent permitted by law, DegenFeed and its operators shall not be liable for
        any indirect, incidental, or consequential damages arising from your use of the service.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">7. Governing Law</h2>
      <p className="mb-4">
        These terms are governed by the laws of the State of Wyoming, United States, without regard
        to conflict of law principles.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">8. Changes</h2>
      <p>
        We may update these terms. Continued use after changes constitutes acceptance. DegenFeed is
        operated by Rug Munch Media LLC, a Wyoming limited liability company.
      </p>
    </div>
  );
}

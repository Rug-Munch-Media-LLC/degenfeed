import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service — DegenFeed' };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-white">Terms of Service</h1>
      <p className="mb-4 text-gray-500">Last updated: July 2026</p>

      <h2 className="mb-2 text-lg font-semibold text-white">1. Acceptance</h2>
      <p className="mb-4">
        By using DegenFeed, you agree to these terms. If you do not agree, do not use the service.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">2. Eligibility</h2>
      <p className="mb-4">
        You must be at least 13 years old. If you are under 18, you need parental consent.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">3. Your Content</h2>
      <p className="mb-4">
        You own the content you post. By posting, you grant DegenFeed a limited license to display
        it in feeds and search results. DegenFeed does not claim ownership of your posts. DegenFeed
        is an aggregator — your posts live on the underlying protocols (Nostr, Farcaster, Lens,
        Bluesky, Mastodon). DegenFeed does not store or archive your content beyond what is
        necessary to display feeds.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">4. Acceptable Use</h2>
      <p className="mb-4">
        See our{' '}
        <a href="/acceptable-use" className="text-degen-400 underline">
          Acceptable Use Policy
        </a>
        .
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">5. Disclaimer</h2>
      <p className="mb-4">
        DegenFeed is provided &ldquo;as is&rdquo; without warranty. We are not responsible for
        content posted by third parties on connected networks. Content may include financial
        opinions — nothing on DegenFeed is financial advice.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">6. Limitation of Liability</h2>
      <p className="mb-4">
        To the fullest extent permitted by law, DegenFeed and its operators shall not be liable for
        any indirect, incidental, or consequential damages arising from your use of the service.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">7. Changes</h2>
      <p>We may update these terms. Continued use after changes constitutes acceptance.</p>
    </div>
  );
}

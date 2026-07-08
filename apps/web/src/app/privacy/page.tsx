import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy for DegenFeed, operated by Rug Munch Media LLC. No tracking, no ads, no data sales.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-4 text-gray-500">Last updated: July 2026</p>

      <h2 className="mb-2 text-lg font-semibold text-white">1. What We Collect</h2>
      <p className="mb-4">DegenFeed is an open-source social aggregator. We store:</p>
      <ul className="mb-4 list-inside list-disc space-y-1">
        <li>Wallet addresses (Ethereum/Solana) you choose to sign in with.</li>
        <li>
          Social protocol credentials (Nostr nsec, Bluesky app passwords, etc.) encrypted in your
          browser — <strong>never sent to our servers</strong>.
        </li>
        <li>Email addresses if you subscribe to the newsletter.</li>
        <li>
          Preferences (hide low-quality, non-crypto toggle, favorite niches) stored in Cloudflare
          KV, keyed to your wallet address.
        </li>
      </ul>

      <h2 className="mb-2 text-lg font-semibold text-white">2. What We Do NOT Collect</h2>
      <ul className="mb-4 list-inside list-disc space-y-1">
        <li>Your name, phone number, or physical address.</li>
        <li>IP addresses (Cloudflare may log them for DDoS protection; we do not store them).</li>
        <li>Browsing history outside DegenFeed.</li>
        <li>
          Cookies beyond the session cookie (
          <code className="rounded bg-gray-800 px-1 text-xs">__Host-dfid</code>) used for sign-in.
        </li>
      </ul>

      <h2 className="mb-2 text-lg font-semibold text-white">3. How We Use Data</h2>
      <p className="mb-4">
        Your wallet address is used to personalize your feed (show posts from followed accounts,
        apply your quality filter). Newsletter emails are used only to send the daily digest.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">4. Your Rights</h2>
      <p className="mb-4">You can export or delete all your data at any time:</p>
      <ul className="mb-4 list-inside list-disc space-y-1">
        <li>
          Export: sign in and visit{' '}
          <code className="rounded bg-gray-800 px-1 text-xs">/api/account/export</code>
        </li>
        <li>
          Delete: sign in and POST to{' '}
          <code className="rounded bg-gray-800 px-1 text-xs">/api/account/delete</code>
        </li>
        <li>All data is stored in Cloudflare KV. Deletion is immediate and permanent.</li>
      </ul>

      <h2 className="mb-2 text-lg font-semibold text-white">5. GDPR Rights (EU/EEA Users)</h2>
      <p className="mb-4">
        If you are in the EU or EEA, you have the right to access, rectify, delete, and port your
        data. To exercise these rights, contact{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>
        . Our Data Protection Officer can be reached at{' '}
        <a href="mailto:legal@rugmunch.io" className="text-degen-400 underline">
          legal@rugmunch.io
        </a>
        .
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">6. CCPA Rights (California Users)</h2>
      <p className="mb-4">
        California residents have the right to know what personal data we collect, request deletion,
        and opt out of data sales. DegenFeed does not sell personal data. To exercise CCPA rights,
        email{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>
        .
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">7. COPPA Compliance</h2>
      <p className="mb-4">
        DegenFeed does not knowingly collect personal information from children under 13. If you
        believe a child has provided us with personal data, contact{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>{' '}
        and we will delete it promptly.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">8. Third Parties</h2>
      <p className="mb-4">
        We use Cloudflare (infrastructure) and Plausible (anonymous analytics). No ad networks, no
        trackers, no data brokers.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">9. Contact</h2>
      <p>
        DegenFeed is operated by Rug Munch Media LLC, a Wyoming limited liability company. For
        privacy questions, contact{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>
        .
      </p>
    </div>
  );
}

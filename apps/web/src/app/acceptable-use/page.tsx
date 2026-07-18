import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — DegenFeed',
  description:
    'Acceptable Use Policy for DegenFeed. Rules for using the open-source multi-protocol social aggregator.',
  openGraph: {
    title: 'Acceptable Use Policy — DegenFeed',
    description: 'Acceptable Use Policy for DegenFeed.',
    url: 'https://app.degenfeed.xyz/acceptable-use',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Acceptable Use Policy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acceptable Use Policy — DegenFeed',
    description: 'Acceptable Use Policy for DegenFeed.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/acceptable-use' },
};

export default function AcceptableUsePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">Acceptable Use Policy</h1>
      <p className="mb-4 text-gray-500">Last updated: July 2026</p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">1. No Illegal Activities</h2>
      <p className="mb-4">
        You may not use DegenFeed to engage in, promote, or facilitate any activity that violates
        local, state, federal, or international law. This includes but is not limited to money
        laundering, sanctions evasion, unlicensed money transmission, and the sale of controlled
        substances.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">2. No Financial Scams</h2>
      <p className="mb-4">
        The following are strictly prohibited: pump-and-dump coordination, Ponzi or pyramid schemes,
        rug pull planning or promotion, fake token launches, phishing links, wallet drainers, fake
        airdrops, impersonation of projects or founders for financial gain, and any other activity
        designed to defraud or deceive users for monetary benefit.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">3. No Hate Speech</h2>
      <p className="mb-4">
        Harassment, hate speech, threats of violence, targeted abuse, doxxing, and impersonation are
        not tolerated. This includes attacks based on race, ethnicity, religion, gender, sexual
        orientation, disability, or any other protected characteristic. Impersonating other users,
        public figures, or projects is prohibited.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">4. No Spam</h2>
      <p className="mb-4">
        Mass posting, excessive self-promotion, link flooding, repetitive content, unsolicited
        commercial messages, and bot-driven activity are not allowed. DegenFeed is for genuine human
        interaction.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">5. No CSAM / Exploitation</h2>
      <p className="mb-4">
        Child sexual abuse material (CSAM) and any content that exploits minors is absolutely
        prohibited. We maintain a zero-tolerance policy. Any such content will be immediately
        removed, the account will be permanently banned, and the incident will be reported to the
        National Center for Missing &amp; Exploited Children (NCMEC) and relevant law enforcement
        authorities.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">6. AI Disclosure</h2>
      <p className="mb-4">
        Content generated or substantially assisted by artificial intelligence must be clearly
        marked as such. Deepfakes, voice clones, or other synthetic media used for impersonation or
        deception are strictly prohibited. Transparency about AI use helps maintain trust in our
        community.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">7. Copyright</h2>
      <p className="mb-4">
        Respect intellectual property rights. Do not post content you do not own or have permission
        to share. If you believe your copyright has been infringed, follow our DMCA process by
        emailing{' '}
        <a href="mailto:dmca@degenfeed.xyz" className="text-degen-400 underline">
          dmca@degenfeed.xyz
        </a>{' '}
        with a complete takedown notice. We respond to valid DMCA notices within 48 hours.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">8. Enforcement</h2>
      <p>
        We reserve the right to suspend or ban accounts, remove content, limit access to features,
        and report violations to law enforcement or relevant authorities. We may also defederate
        from instances that violate this policy. Enforcement decisions are made at our sole
        discretion but are always applied in good faith to protect the community.
      </p>
    </div>
  );
}

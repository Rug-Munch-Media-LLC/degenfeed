import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal Notice — DegenFeed',
  description:
    'Legal notice and company information for DegenFeed, operated by Rug Munch Media LLC.',
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-2 text-2xl font-bold text-white">Legal Notice</h1>
      <p className="mb-8 text-lg text-degen-400">Rug Munch Media LLC</p>

      <h2 className="mb-2 text-lg font-semibold text-white">Company</h2>
      <p className="mb-4">
        DegenFeed is a product of Rug Munch Media LLC, a Wyoming limited liability company.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">Registered Office</h2>
      <p className="mb-4">Registered in the State of Wyoming, United States of America.</p>

      <h2 className="mb-2 text-lg font-semibold text-white">Contact</h2>
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

      <h2 className="mb-2 text-lg font-semibold text-white">DMCA Agent</h2>
      <p className="mb-4">
        For copyright-related takedown requests:{' '}
        <a href="mailto:dmca@degenfeed.xyz" className="text-degen-400 underline">
          dmca@degenfeed.xyz
        </a>
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">Data Protection Officer</h2>
      <p className="mb-4">
        For GDPR and data privacy inquiries:{' '}
        <a href="mailto:legal@rugmunch.io" className="text-degen-400 underline">
          legal@rugmunch.io
        </a>
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">Disclaimer</h2>
      <p className="mb-4">
        DegenFeed is provided &ldquo;as is&rdquo; without warranty of any kind. DegenFeed is not a
        financial services platform. Nothing on DegenFeed constitutes financial advice. All
        trademarks and registered trademarks are the property of their respective owners.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-white">Governing Law</h2>
      <p className="mb-4">
        These terms and your use of DegenFeed are governed by the laws of the State of Wyoming,
        United States, without regard to conflict of law principles.
      </p>
    </div>
  );
}

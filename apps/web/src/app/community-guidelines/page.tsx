import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Community Guidelines — DegenFeed',
};

export default function CommunityGuidelinesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-2 text-2xl font-bold text-white">Community Guidelines</h1>
      <p className="mb-6 text-gray-500">Federated instance rules for social.degenfeed.xyz</p>

      <ol className="mb-4 list-inside space-y-4">
        <li>
          <h2 className="inline text-lg font-semibold text-white">Be Respectful</h2>
          <p className="mt-1 ml-5">
            No harassment, hate speech, or personal attacks. Treat others with basic human decency.
            Disagreement is fine — being a jerk is not.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">No Spam or Bots</h2>
          <p className="mt-1 ml-5">
            Genuine human interaction only. No automated accounts, crypto spam, link flooding, or
            repetitive self-promotion. Bots are not permitted without explicit admin approval.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">No CSAM</h2>
          <p className="mt-1 ml-5">
            Zero tolerance for child sexual abuse material or any content exploiting minors.
            Immediate ban and report to NCMEC and law enforcement. No exceptions, no warnings.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">No Financial Scams</h2>
          <p className="mt-1 ml-5">
            No pump-and-dump coordination, rug pulls, fake ICOs, phishing links, wallet drainers, or
            any scheme designed to steal money or tokens. Share alpha, not scams.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">No Doxxing</h2>
          <p className="mt-1 ml-5">
            Do not share private personal information about others without their explicit consent.
            This includes real names, addresses, phone numbers, private photos, and financial
            information.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">No Impersonation</h2>
          <p className="mt-1 ml-5">
            Do not pretend to be someone else. This includes impersonating other users, public
            figures, projects, companies, or officials. Parody accounts must be clearly labeled as
            such.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">Disclose AI Content</h2>
          <p className="mt-1 ml-5">
            Mark AI-generated or AI-assisted posts clearly. Be honest about what you created versus
            what a model generated. No deepfakes used for impersonation or deception.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">Respect Copyright</h2>
          <p className="mt-1 ml-5">
            Do not post content you do not own or have permission to share. Follow DMCA procedures
            for takedown requests at{' '}
            <a href="mailto:dmca@degenfeed.xyz" className="text-degen-400 underline">
              dmca@degenfeed.xyz
            </a>
            .
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">English Primary</h2>
          <p className="mt-1 ml-5">
            English is the main language of this instance, but all languages are welcome in their
            respective communities. Use content warnings and hashtags to help others filter.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">No Illegal Activities</h2>
          <p className="mt-1 ml-5">
            Comply with all applicable laws. This includes laws in your jurisdiction, the United
            States (where our servers are located), and the jurisdictions of federated instances you
            interact with.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">Mark Adult Content</h2>
          <p className="mt-1 ml-5">
            Use content warnings for NSFW material. Unmarked adult content will be removed. Illegal
            content will be reported. Keep the instance safe for all users.
          </p>
        </li>
        <li>
          <h2 className="inline text-lg font-semibold text-white">Be a Good Fediverse Citizen</h2>
          <p className="mt-1 ml-5">
            Do not harass users on other instances, do not exploit federation to bypass blocks or
            bans, and do not use the instance as a launchpad for cross-instance spam campaigns.
            Respect the rules of federated instances you interact with.
          </p>
        </li>
      </ol>

      <p className="mt-6 text-gray-500">
        Violations may result in content removal, account suspension, or instance defederation.
        Reports:{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>
      </p>
    </div>
  );
}

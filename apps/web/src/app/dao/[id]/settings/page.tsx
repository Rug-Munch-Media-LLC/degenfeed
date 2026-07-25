'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AppearanceSection,
  DangerZone,
  GovernanceSection,
  IntegrationsSection,
  ProfileSection,
  TreasurySection,
} from '../../../../components/dao-settings';
import type { GovernanceParam } from '../../../../components/dao-settings/GovernanceSection';
import { MOCK_DAO } from '../layout';

const DEFAULT_GOVERNANCE_PARAMS: GovernanceParam[] = [
  {
    key: 'quorum',
    label: 'Quorum Threshold',
    value: '10%',
    description: 'Minimum % of total voting power required for a valid vote',
    requiresConstitutional: true,
  },
  {
    key: 'threshold',
    label: 'Approval Threshold',
    value: '60%',
    description: 'Minimum % of FOR votes required for a proposal to pass',
    requiresConstitutional: true,
  },
  {
    key: 'votingPeriod',
    label: 'Voting Period',
    value: '7 days',
    description: 'Duration each proposal remains open for voting',
    requiresConstitutional: true,
  },
  {
    key: 'timelock',
    label: 'Timelock Duration',
    value: '48 hours',
    description: 'Delay before passed proposals can be executed',
    requiresConstitutional: true,
  },
  {
    key: 'minProposalPower',
    label: 'Min Proposal Power',
    value: '50,000',
    description: 'Minimum voting power required to create a proposal',
    requiresConstitutional: false,
  },
];

export default function DAOSettingsPage({ params }: { params: { id: string } }) {
  const [daoName, setDaoName] = useState(MOCK_DAO.name);
  const [daoDescription, setDaoDescription] = useState(MOCK_DAO.description);
  const [daoAvatar, setDaoAvatar] = useState(MOCK_DAO.avatar);
  const [bannerColor, setBannerColor] = useState('#00ff41');
  const [twitterLink, setTwitterLink] = useState(MOCK_DAO.socialLinks.twitter);
  const [discordLink, setDiscordLink] = useState(MOCK_DAO.socialLinks.discord);
  const [telegramLink, setTelegramLink] = useState(MOCK_DAO.socialLinks.telegram);
  const [websiteLink, setWebsiteLink] = useState(MOCK_DAO.socialLinks.website);
  const [showDangerConfirm, setShowDangerConfirm] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
          DAO
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--color-fg)]">Settings</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-black text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            DAO Settings
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Manage your DAO&apos;s configuration, governance, and team.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-95"
        >
          Save Changes
        </button>
      </div>

      <div className="space-y-6">
        <ProfileSection
          daoName={daoName}
          setDaoName={setDaoName}
          daoDescription={daoDescription}
          setDaoDescription={setDaoDescription}
          daoAvatar={daoAvatar}
          setDaoAvatar={setDaoAvatar}
          twitterLink={twitterLink}
          setTwitterLink={setTwitterLink}
          discordLink={discordLink}
          setDiscordLink={setDiscordLink}
          telegramLink={telegramLink}
          setTelegramLink={setTelegramLink}
          websiteLink={websiteLink}
          setWebsiteLink={setWebsiteLink}
        />
        <GovernanceSection params={DEFAULT_GOVERNANCE_PARAMS} />
        <TreasurySection />
        <AppearanceSection bannerColor={bannerColor} setBannerColor={setBannerColor} />
        <IntegrationsSection />
        <DangerZone
          showDangerConfirm={showDangerConfirm}
          setShowDangerConfirm={setShowDangerConfirm}
        />
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--color-glass-border)] pt-6">
        <p className="text-[10px] text-[var(--color-muted)]">
          Changes are saved locally. Click save to persist all changes.
        </p>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-95"
        >
          Save All Changes
        </button>
      </div>
    </div>
  );
}

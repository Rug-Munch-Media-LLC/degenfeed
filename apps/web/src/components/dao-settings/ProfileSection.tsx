'use client';

import { SettingsSection } from './SettingsSection';

interface ProfileSectionProps {
  daoName: string;
  setDaoName: (v: string) => void;
  daoDescription: string;
  setDaoDescription: (v: string) => void;
  daoAvatar: string;
  setDaoAvatar: (v: string) => void;
  twitterLink: string;
  setTwitterLink: (v: string) => void;
  discordLink: string;
  setDiscordLink: (v: string) => void;
  telegramLink: string;
  setTelegramLink: (v: string) => void;
  websiteLink: string;
  setWebsiteLink: (v: string) => void;
}

export function ProfileSection({
  daoName,
  setDaoName,
  daoDescription,
  setDaoDescription,
  daoAvatar,
  setDaoAvatar,
  twitterLink,
  setTwitterLink,
  discordLink,
  setDiscordLink,
  telegramLink,
  setTelegramLink,
  websiteLink,
  setWebsiteLink,
}: ProfileSectionProps) {
  return (
    <>
      <SettingsSection
        title="DAO Profile"
        description="Update your DAO's name, description, and branding."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-degen-500/10 text-2xl">
                {daoAvatar}
              </span>
              <button
                type="button"
                onClick={() => {
                  const emoji = prompt('Enter emoji for DAO avatar:');
                  if (emoji) setDaoAvatar(emoji);
                }}
                className="text-[9px] text-degen-400 hover:underline"
              >
                Change
              </button>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label
                  htmlFor="dao-name"
                  className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
                >
                  DAO Name
                </label>
                <input
                  id="dao-name"
                  type="text"
                  value={daoName}
                  onChange={(e) => setDaoName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="dao-desc"
                  className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
                >
                  Description
                </label>
                <textarea
                  id="dao-desc"
                  value={daoDescription}
                  rows={3}
                  onChange={(e) => setDaoDescription(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors resize-y"
                />
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Social Links">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="twitter"
              className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              Twitter
            </label>
            <input
              id="twitter"
              type="url"
              value={twitterLink}
              onChange={(e) => setTwitterLink(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="discord"
              className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              Discord
            </label>
            <input
              id="discord"
              type="url"
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="telegram"
              className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              Telegram
            </label>
            <input
              id="telegram"
              type="url"
              value={telegramLink}
              onChange={(e) => setTelegramLink(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="website"
              className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              Website
            </label>
            <input
              id="website"
              type="url"
              value={websiteLink}
              onChange={(e) => setWebsiteLink(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
            />
          </div>
        </div>
      </SettingsSection>
    </>
  );
}

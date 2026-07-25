'use client';

import { SettingsSection } from './SettingsSection';

export function AppearanceSection({
  bannerColor,
  setBannerColor,
}: {
  bannerColor: string;
  setBannerColor: (v: string) => void;
}) {
  return (
    <SettingsSection title="Appearance" description="Customize your DAO's visual identity.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bannerColor}
              onChange={(e) => setBannerColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--color-glass-border)] bg-transparent"
            />
            <span className="font-mono text-[10px] text-[var(--color-muted)]">{bannerColor}</span>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
            Preview
          </label>
          <div
            className="h-10 rounded-lg border border-[var(--color-glass-border)]"
            style={{ backgroundColor: `${bannerColor}20`, borderColor: `${bannerColor}40` }}
          >
            <div className="h-full w-1/3 rounded-lg" style={{ backgroundColor: bannerColor }} />
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

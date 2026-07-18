'use client';

/**
 * @components/CredentialsDisplay — Portable credential cards.
 *
 * Shows platform name, instance URL, username, credential type (access token,
 * password, nsec), Copy button, Download button, and a security note.
 * Exposes a standalone component and a per-platform static card.
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { useToast } from './Toast';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PlatformCredential {
  platform: string;
  label: string;
  icon: string;
  color: string;
  instanceUrl: string;
  username: string;
  fields: CredentialField[];
  apps?: RecommendedApp[];
}

export interface CredentialField {
  key: string;
  label: string;
  value: string;
  sensitive?: boolean; // masks the value
  monospace?: boolean;
}

export interface RecommendedApp {
  name: string;
  url: string;
  description: string;
}

// ─── Platform registry ────────────────────────────────────────────────────

export const PLATFORM_CREDENTIAL_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  bluesky: { label: 'Bluesky', icon: '☁', color: '#1185fe' },
  nostr: { label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  farcaster: { label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  lens: { label: 'Lens', icon: '◎', color: '#abfe2c' },
};

// ─── Single credential field row ──────────────────────────────────────────

function CredentialFieldRow({
  field,
  onCopied,
}: {
  field: CredentialField;
  onCopied: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const canReveal = field.sensitive;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      onCopied();
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = field.value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onCopied();
    }
  }, [field.value, onCopied]);

  const displayValue = field.sensitive && !revealed
    ? '••••••••••••••••'
    : field.value;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {field.label}
        </div>
        <div
          className={`mt-0.5 truncate text-xs font-medium text-[var(--color-fg)] ${
            field.monospace ? 'font-mono tracking-tight' : ''
          }`}
          title={field.value}
        >
          {displayValue}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {canReveal && (
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label={revealed ? 'Hide credential' : 'Show credential'}
          >
            {revealed ? '🙈 Hide' : '👁 Show'}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg px-2 py-1 text-[10px] font-medium text-degen-400 transition-colors hover:bg-degen-500/10"
          aria-label={`Copy ${field.label}`}
        >
          📋 Copy
        </button>
      </div>
    </div>
  );
}

// ─── Recommended apps section ─────────────────────────────────────────────

function RecommendedAppsSection({ apps }: { apps: RecommendedApp[] }) {
  if (apps.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-degen-500/10 bg-degen-500/[0.03] px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-degen-400/70">
        Login elsewhere
      </p>
      <p className="mb-2 text-[10px] text-[var(--color-muted)]">
        Use your credentials on these popular apps:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {apps.map((app) => (
          <a
            key={app.name}
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-overlay)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-accent)]"
            title={app.description}
          >
            {app.name}
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="opacity-40"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Single credential card ───────────────────────────────────────────────

interface CredentialCardProps {
  credential: PlatformCredential;
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const { showToast } = useToast();

  const handleCopied = useCallback(() => {
    showToast('success', 'Copied to clipboard!');
  }, [showToast]);

  const handleDownload = useCallback(() => {
    const lines: string[] = [
      `── ${credential.label} Credentials ──`,
      `Platform:  ${credential.label}`,
      `Instance:  ${credential.instanceUrl}`,
      `Username:  ${credential.username}`,
      '',
      'Credentials:',
    ];
    for (const field of credential.fields) {
      lines.push(`  ${field.label}: ${field.value}`);
    }
    lines.push('');
    lines.push('┌─────────────────────────────────────────┐');
    lines.push('│  Your credentials are encrypted and     │');
    lines.push('│  stored securely. We never share them   │');
    lines.push('│  with third parties. You can revoke     │');
    lines.push('│  access at any time.                    │');
    lines.push('└─────────────────────────────────────────┘');
    lines.push('');
    lines.push('Recommended apps:');
    for (const app of credential.apps ?? []) {
      lines.push(`  • ${app.name} — ${app.url}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${credential.platform}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Credentials downloaded!');
  }, [credential, showToast]);

  const color = credential.color;

  return (
    <div
      className="overflow-hidden rounded-xl border transition-all"
      style={{ borderColor: `${color}33`, backgroundColor: `${color}06` }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: `1px solid ${color}22` }}
      >
        <span className="text-xl" aria-hidden="true">
          {credential.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--color-fg)]">{credential.label}</h3>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {credential.platform}
            </span>
          </div>
          <p className="truncate text-[11px] text-[var(--color-muted)]">
            {credential.username} · {credential.instanceUrl}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          aria-label="Download credentials"
        >
          ⬇ Download
        </button>
      </div>

      {/* Credential fields */}
      <div className="space-y-2 px-4 py-3">
        {credential.fields.map((field) => (
          <CredentialFieldRow key={field.key} field={field} onCopied={handleCopied} />
        ))}
      </div>

      {/* Recommended apps */}
      {credential.apps && credential.apps.length > 0 && (
        <div className="px-4 pb-3">
          <RecommendedAppsSection apps={credential.apps} />
        </div>
      )}
    </div>
  );
}

// ─── Portal-style credential info banner ─────────────────────────────────

interface CredentialsInfoBannerProps {
  connectedCount: number;
  totalPlatforms: number;
}

export function CredentialsProgressBanner({
  connectedCount,
  totalPlatforms,
}: CredentialsInfoBannerProps) {
  const percent = Math.round((connectedCount / totalPlatforms) * 100);
  const remaining = totalPlatforms - connectedCount;

  if (connectedCount >= totalPlatforms) {
    return (
      <div className="rounded-xl border border-degen-500/20 bg-gradient-to-r from-degen-500/10 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-degen-400 text-lg">✓</span>
          <div>
            <p className="text-sm font-bold text-degen-400">
              All {totalPlatforms} platforms connected!
            </p>
            <p className="text-[11px] text-[var(--color-muted)]">
              You can use any of these credentials to login on third-party apps.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="var(--color-glass-border)"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(percent / 100) * 125.6} 125.6`}
              transform="rotate(-90 24 24)"
              style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
            />
          </svg>
          <span className="absolute text-xs font-bold text-degen-400">{percent}%</span>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--color-fg)]">
            {connectedCount}/{totalPlatforms} platforms connected
          </p>
          <p className="text-[11px] text-[var(--color-muted)]">
            {remaining > 0
              ? `Create accounts on the remaining ${remaining} to unlock cross-protocol posting.`
              : 'All platforms connected!'}
          </p>
        </div>
      </div>
      {/* Mini progress dots */}
      <div className="mt-2 flex gap-1">
        {Array.from({ length: totalPlatforms }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < connectedCount ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-overlay)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Security note banner ────────────────────────────────────────────────

export function CredentialSecurityNote() {
  return (
    <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-sm" aria-hidden="true">
          🔒
        </span>
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">
            Your credentials are encrypted and stored securely.
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
            We never share them with third parties. You can revoke access at any time from your
            account settings. For security, avoid sharing your credentials publicly.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Recommended apps by platform ─────────────────────────────────────────

export function getRecommendedApps(platform: string): RecommendedApp[] {
  switch (platform) {
    case 'mastodon':
      return [
        { name: 'Ivory', url: 'https://ivory.app', description: 'iOS Mastodon client' },
        { name: 'Mona', url: 'https://mona.app', description: 'iOS Mastodon client' },
        { name: 'Ice Cubes', url: 'https://icecubes.app', description: 'Open-source iOS client' },
        { name: 'Tusky', url: 'https://tusky.app', description: 'Android Mastodon client' },
        { name: 'Elk', url: 'https://elk.zone', description: 'Web-based Mastodon client' },
        { name: 'Metatext', url: 'https://github.com/metabolist/metatext', description: 'iOS client' },
      ];
    case 'bluesky':
      return [
        { name: 'Graysky', url: 'https://graysky.app', description: 'Mobile Bluesky client' },
        { name: 'Skeets', url: 'https://skeets.app', description: 'iOS Bluesky client' },
        { name: 'Deck.blue', url: 'https://deck.blue', description: 'TweetDeck-style web client' },
        { name: 'Bluesky (Official)', url: 'https://bsky.app', description: 'Official Bluesky web app' },
      ];
    case 'nostr':
      return [
        { name: 'Damus', url: 'https://damus.io', description: 'iOS Nostr client' },
        { name: 'Amethyst', url: 'https://amethyst.social', description: 'Android Nostr client' },
        { name: 'Snort', url: 'https://snort.social', description: 'Web Nostr client' },
        { name: 'Primal', url: 'https://primal.net', description: 'Web & mobile Nostr client' },
        { name: 'Coracle', url: 'https://coracle.social', description: 'Web Nostr client' },
      ];
    case 'farcaster':
      return [
        { name: 'Warpcast', url: 'https://warpcast.com', description: 'Official Farcaster client' },
        { name: 'Supercast', url: 'https://supercast.xyz', description: 'Web Farcaster client' },
        { name: 'Recaster', url: 'https://recaster.xyz', description: 'Web Farcaster client' },
      ];
    case 'lens':
      return [
        { name: 'Orb', url: 'https://orb.ac', description: 'Web Lens client' },
        { name: 'Phaver', url: 'https://phaver.com', description: 'Mobile Lens client' },
        { name: 'Buttrfly', url: 'https://buttrfly.app', description: 'Web Lens client' },
        { name: 'Lens (Official)', url: 'https://lens.xyz', description: 'Official Lens app' },
      ];
    default:
      return [];
  }
}

// ─── Build credential from registration result ────────────────────────────

// Re-using the local type instead of importing from @degenfeed/crossplatform-register
// which isn't a direct dependency of apps/web. The shape matches PlatformAccount
// from @degenfeed/ui.
export interface RegistrationResultData {
  platform: string;
  status: 'pending' | 'created' | 'failed';
  username?: string;
  error?: string;
  txHash?: string;
  accountInfo?: Record<string, string>;
}

export function registrationToCredential(
  reg: RegistrationResultData,
): PlatformCredential | null {
  if (reg.status !== 'created' || !reg.accountInfo) return null;

  const meta = PLATFORM_CREDENTIAL_META[reg.platform];
  if (!meta) return null;

  const base: Omit<PlatformCredential, 'fields'> = {
    platform: reg.platform,
    label: meta.label,
    icon: meta.icon,
    color: meta.color,
    instanceUrl: '',
    username: reg.username ?? '',
    apps: getRecommendedApps(reg.platform),
  };

  switch (reg.platform) {
    case 'mastodon': {
      const instance = reg.accountInfo.instance || 'social.degenfeed.xyz';
      return {
        ...base,
        instanceUrl: instance,
        fields: [
          { key: 'instance', label: 'Instance URL', value: instance, monospace: true },
          { key: 'username', label: 'Username', value: reg.accountInfo.username ?? reg.username ?? '', monospace: true },
          { key: 'password', label: 'Password', value: reg.accountInfo.password ?? '(generated at signup, reset if forgotten)', sensitive: true },
          { key: 'accessToken', label: 'Access Token', value: reg.accountInfo.accessToken ?? '(available via OAuth)', sensitive: true, monospace: true },
        ],
      };
    }
    case 'bluesky': {
      return {
        ...base,
        instanceUrl: 'bsky.social',
        fields: [
          { key: 'handle', label: 'Handle', value: reg.accountInfo.handle ?? reg.username ?? '', monospace: true },
          { key: 'did', label: 'DID', value: reg.accountInfo.did ?? '', monospace: true },
          { key: 'appPassword', label: 'App Password', value: reg.accountInfo.appPassword ?? '(generated at signup)', sensitive: true, monospace: true },
        ],
      };
    }
    case 'nostr': {
      return {
        ...base,
        instanceUrl: 'Decentralized (relay-based)',
        fields: [
          { key: 'npub', label: 'Public Key (npub)', value: reg.accountInfo.npub ?? '', monospace: true },
          { key: 'nsec', label: 'Private Key (nsec)', value: reg.accountInfo._encryptedNsec ?? '(encrypted)', sensitive: true, monospace: true },
          { key: 'pubkey', label: 'Hex Public Key', value: reg.accountInfo.pubkey ?? '', monospace: true },
        ],
      };
    }
    case 'farcaster': {
      return {
        ...base,
        instanceUrl: 'Farcaster Hub (on-chain)',
        fields: [
          { key: 'fid', label: 'FID', value: reg.accountInfo.fid ?? '', monospace: true },
          { key: 'username', label: 'Username', value: reg.accountInfo.username ?? reg.username ?? '', monospace: true },
          { key: 'recoveryAddress', label: 'Recovery Address', value: reg.accountInfo.recoveryAddress ?? '', monospace: true },
        ],
      };
    }
    case 'lens': {
      return {
        ...base,
        instanceUrl: 'Lens Protocol (Polygon)',
        fields: [
          { key: 'handle', label: 'Handle', value: reg.accountInfo.handle ?? reg.username ?? '', monospace: true },
          { key: 'profileId', label: 'Profile ID', value: reg.accountInfo.profileId ?? '', monospace: true },
        ],
      };
    }
    default:
      return null;
  }
}

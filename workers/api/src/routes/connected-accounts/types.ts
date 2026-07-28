export interface ConnectedAccount {
  platform: string;
  username: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  avatarUrl?: string;
  displayName?: string;
  connectedAt: number;
}

export const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  medium: 'Medium',
  google: 'Google',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  github: 'GitHub',
  discord: 'Discord',
  twitter: 'Twitter',
  telegram: 'Telegram',
};

export const PLATFORM_ICONS: Record<string, string> = {
  reddit: 'reddit',
  medium: 'medium',
  google: 'google',
  linkedin: 'linkedin',
  instagram: 'instagram',
  pinterest: 'pinterest',
  tiktok: 'tiktok',
  github: 'github',
  discord: 'discord',
  twitter: 'twitter',
  telegram: 'telegram',
};

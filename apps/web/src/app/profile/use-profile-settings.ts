'use client';

/**
 * useProfileSettings — reads the creator settings persisted by the settings
 * page (`degenfeed:settings` in localStorage) so the public profile page can
 * render the customized bio, avatar, cover, and custom links.
 */

import { useEffect, useState } from 'react';
import type { CreatorSettings } from './types';

export interface ProfileCustomization {
  bio: string;
  avatarUrl?: string;
  coverUrl?: string;
  customLinks: Array<{ label: string; url: string }>;
}

const EMPTY: ProfileCustomization = {
  bio: '',
  customLinks: [],
};

export function useProfileSettings(): ProfileCustomization {
  const [customization, setCustomization] = useState<ProfileCustomization>(EMPTY);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('degenfeed:settings');
      if (!raw) return;
      const parsed = JSON.parse(raw) as CreatorSettings;
      setCustomization({
        bio: parsed.profile?.bio ?? '',
        avatarUrl: parsed.profile?.avatarUrl,
        coverUrl: parsed.profile?.coverUrl,
        customLinks: parsed.profile?.customLinks ?? [],
      });
    } catch {
      // ignore — keep defaults
    }
  }, []);

  return customization;
}

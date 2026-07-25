'use client';

import { Toggle } from './Toggle';
import type { Preferences } from './types';

interface PrivacySectionProps {
  prefs: Preferences;
  setPrivacy: (p: Preferences['privacy']) => void;
}

export function PrivacySection({ prefs, setPrivacy }: PrivacySectionProps) {
  return (
    <div>
      <Toggle id="privacy-public" checked={prefs.privacy.publicProfile}
        onChange={(v) => setPrivacy({ ...prefs.privacy, publicProfile: v })} label="Public profile" />
      <Toggle id="privacy-tips" checked={prefs.privacy.showTipsReceived}
        onChange={(v) => setPrivacy({ ...prefs.privacy, showTipsReceived: v })} label="Show tips received" />
      <Toggle id="privacy-followers" checked={prefs.privacy.showFollowers}
        onChange={(v) => setPrivacy({ ...prefs.privacy, showFollowers: v })} label="Show followers" />
    </div>
  );
}

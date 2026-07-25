'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { usePremium } from '../../hooks/usePremium';
import { useAuth } from '../AuthProvider';
import { PremiumPaymentModal } from '../PremiumPaymentModal';
import { useToast } from '../Toast';
import { SettingsSection } from './SettingsSection';
import { AccountSection } from './AccountSection';
import { AppearanceSection } from './AppearanceSection';
import { NotificationsSection } from './NotificationsSection';
import { PrivacySection } from './PrivacySection';
import { SecuritySection } from './SecuritySection';
import { ContentSection } from './ContentSection';
import { SubscriptionSection } from './SubscriptionSection';
import { ApiSection } from './ApiSection';
import { StreamingSection } from './StreamingSection';
import type { Section } from './types';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { walletAddress } = useAuth();
  const { refresh: refreshPremium } = usePremium();
  const { prefs, setTheme, setFontSize, setLayoutDensity, toggleNotificationType, setPrivacy, setContent, saveToServer, saving, saveStatus, addMutedWord, removeMutedWord, addMutedUser, removeMutedUser, addBlockedUser, removeBlockedUser } = usePreferences();
  const [openSections, setOpenSections] = useState<Section[]>(['appearance']);
  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [crossPlatformKey, setCrossPlatformKey] = useState(0);

  const toggleSection = useCallback((s: Section) => {
    setOpenSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  useEffect(() => {
    if (saveStatus === 'saved') showToast('success', 'Preferences saved');
    else if (saveStatus === 'error') showToast('error', 'Failed to save preferences');
  }, [saveStatus, showToast]);

  const handleSaveEmail = useCallback(async () => {
    try {
      const res = await fetch('/api/preferences/email', { method: 'PUT', credentials: 'include',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      if (!res.ok) throw new Error('Failed');
      setEmailSaved(true);
      showToast('success', 'Email saved');
      setTimeout(() => setEmailSaved(false), 3000);
    } catch { showToast('error', 'Failed to save email'); }
  }, [email, showToast]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Customize your DegenFeed experience</p>
        </div>

        <section className="space-y-3" aria-label="Settings sections">
          <SettingsSection section="account" isOpen={openSections.includes('account')} onToggle={() => toggleSection('account')}>
            <AccountSection email={email} onEmailChange={setEmail} onSaveEmail={handleSaveEmail} emailSaved={emailSaved} />
          </SettingsSection>

          <SettingsSection section="appearance" isOpen={openSections.includes('appearance')} onToggle={() => toggleSection('appearance')}>
            <AppearanceSection prefs={prefs} setTheme={setTheme} setFontSize={setFontSize} setLayoutDensity={setLayoutDensity} />
          </SettingsSection>

          <SettingsSection section="notifications" isOpen={openSections.includes('notifications')} onToggle={() => toggleSection('notifications')}>
            <NotificationsSection prefs={prefs} toggleNotificationType={toggleNotificationType} />
          </SettingsSection>

          <SettingsSection section="privacy" isOpen={openSections.includes('privacy')} onToggle={() => toggleSection('privacy')}>
            <PrivacySection prefs={prefs} setPrivacy={setPrivacy} />
          </SettingsSection>

          <SettingsSection section="security" isOpen={openSections.includes('security')} onToggle={() => toggleSection('security')}>
            <SecuritySection />
          </SettingsSection>

          <SettingsSection section="content" isOpen={openSections.includes('content')} onToggle={() => toggleSection('content')}>
            <ContentSection prefs={prefs} setContent={setContent} addMutedWord={addMutedWord} removeMutedWord={removeMutedWord} addMutedUser={addMutedUser} removeMutedUser={removeMutedUser} addBlockedUser={addBlockedUser} removeBlockedUser={removeBlockedUser} />
          </SettingsSection>

          <SettingsSection section="subscription" isOpen={openSections.includes('subscription')} onToggle={() => toggleSection('subscription')}>
            <SubscriptionSection showUpgradeModal={showUpgradeModal} setShowUpgradeModal={setShowUpgradeModal} refreshPremium={refreshPremium} crossPlatformKey={crossPlatformKey} setCrossPlatformKey={setCrossPlatformKey} />
          </SettingsSection>

          <SettingsSection section="api" isOpen={openSections.includes('api')} onToggle={() => toggleSection('api')}>
            <ApiSection />
          </SettingsSection>

          <SettingsSection section="streaming" isOpen={openSections.includes('streaming')} onToggle={() => toggleSection('streaming')}>
            <StreamingSection />
          </SettingsSection>
        </section>

        {/* Save footer */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--color-glass-border)] bg-[var(--color-card)]/95 backdrop-blur-xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:px-0 sm:py-0 lg:pb-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="text-xs text-[var(--color-muted)]">
              {saveStatus === 'saved' && <span className="text-degen-400">✓ Preferences saved</span>}
              {saveStatus === 'error' && <span className="text-red-400">✗ Failed to save</span>}
              {saveStatus === 'idle' && <span>Changes are saved locally</span>}
            </div>
            <button type="button" onClick={saveToServer} disabled={saving} className="btn-primary text-sm">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </span>
              ) : ('Save to server')}
            </button>
          </div>
        </div>

        <PremiumPaymentModal open={showUpgradeModal} onClose={() => { setShowUpgradeModal(false); refreshPremium(); }} onSuccess={refreshPremium} />
      </div>
    </ErrorBoundary>
  );
}

'use client';

import type { PlatformAccount, RegisterPlatformStatusData } from '@degenfeed/ui';
import { useEffect, useState } from 'react';
import {
  CredentialCard,
  CredentialSecurityNote,
  CredentialsProgressBanner,
  registrationToCredential,
} from '../CredentialsDisplay';

export function AccountsCredentialsDisplay({ walletAddress }: { walletAddress?: string }) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    fetch('/api/register-platform/status', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { data: RegisterPlatformStatusData }) => setAccounts(d.data.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
      </div>
    );

  const createdAccounts = accounts.filter((a) => a.status === 'created');
  if (createdAccounts.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
        <p className="text-xs text-[var(--color-muted)]">No accounts created yet.</p>
      </div>
    );

  const credentialCards = createdAccounts
    .map((a) => registrationToCredential(a as Parameters<typeof registrationToCredential>[0]))
    .filter(Boolean) as NonNullable<ReturnType<typeof registrationToCredential>>[];

  return (
    <div className="space-y-4">
      <CredentialsProgressBanner connectedCount={createdAccounts.length} totalPlatforms={5} />
      <div className="space-y-3">
        {credentialCards.map((card) => (
          <CredentialCard key={card.platform} credential={card} />
        ))}
      </div>
      <CredentialSecurityNote />
    </div>
  );
}

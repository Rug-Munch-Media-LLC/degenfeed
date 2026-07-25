'use client';

import type { ThirdPartyConnection } from '../types';

export function ConnectedProtocols({
  accounts,
  loading,
}: {
  accounts: ThirdPartyConnection[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-overlay)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map((acct) => (
        <div
          key={acct.protocol}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3"
        >
          <span className="text-lg">{acct.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-fg)] capitalize">
                {acct.protocol}
              </span>
              {acct.connected && (
                <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-medium text-degen-400">
                  Connected
                </span>
              )}
            </div>
            {acct.handle && <p className="text-xs text-[var(--color-muted)]">{acct.handle}</p>}
            {acct.connected && acct.lastSync && (
              <p className="text-[10px] text-[var(--color-muted)]">
                Last synced: {new Date(acct.lastSync).toLocaleDateString()}
              </p>
            )}
            {acct.dataShared.length > 0 && (
              <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
                Data shared: {acct.dataShared.join(', ')}
              </p>
            )}
          </div>
          <a
            href="/settings/connected-accounts"
            className="rounded-lg border border-[var(--color-glass-border)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Manage
          </a>
        </div>
      ))}
    </div>
  );
}

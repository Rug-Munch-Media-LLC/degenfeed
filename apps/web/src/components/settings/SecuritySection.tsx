'use client';

export function SecuritySection() {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
        Manage security settings: passkeys, TOTP, hardware wallet, recovery codes.
      </p>
      <a
        href="/settings/security"
        className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3 transition-colors hover:bg-[var(--color-card-hover)] group"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium text-[var(--color-fg)]">
              Open full security page
            </span>
            <p className="text-xs text-[var(--color-muted)]">2FA, passkeys, sessions, and more</p>
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </a>
    </div>
  );
}

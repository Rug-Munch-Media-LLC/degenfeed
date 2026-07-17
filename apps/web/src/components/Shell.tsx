'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { memo, useEffect, useState } from 'react';
import { AddToHomeScreenToast } from './AddToHomeScreenToast';
import { useAuth } from './AuthProvider';
import { BottomNav } from './BottomNav';
import { InstallPrompt } from './InstallPrompt';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { OnboardingModal } from './OnboardingModal';
import { SearchOverlay } from './SearchOverlay';
import { useToast } from './Toast';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: '/feed', label: 'Feed' },
  { href: '/trending', label: 'Trending' },
  { href: '/c', label: 'Communities' },
  { href: '/news', label: 'News' },
  { href: '/notifications', label: 'Alerts' },
  { href: '/discover', label: 'Discover' },
  { href: '/deploy', label: 'Launch' },
  { href: '/docs', label: 'Docs' },
  { href: '/premium', label: 'Premium' },
  { href: '/profile', label: 'Profile' },
];

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 group">
      <Image
        src="/icon.svg"
        alt="DegenFeed"
        width={32}
        height={32}
        className="h-8 w-8 rounded-lg logo-glow transition-shadow group-hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]"
      />
      <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
        DegenFeed
      </span>
    </a>
  );
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <a
      href={item.href}
      onClick={onClick}
      className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? 'text-[var(--color-fg)]'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
      }`}
    >
      {item.label}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
      )}
    </a>
  );
}

export const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const { ready, signedInProtocols, openSignIn, openCompose } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const { showToast } = useToast();

  // Listen for custom df-toast events (e.g., from PostCard share)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        kind?: 'info' | 'success' | 'error' | 'warning';
        message: string;
        duration?: number;
      };
      if (detail?.message) {
        showToast(detail.kind || 'success', detail.message, detail.duration);
      }
    };
    window.addEventListener('df-toast', handler);
    return () => window.removeEventListener('df-toast', handler);
  }, [showToast]);

  useEffect(() => {
    const stored = localStorage.getItem('df_theme');
    const resolved = stored === 'light' ? 'light' : 'dark';
    setTheme(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // Sync cookie so subsequent SSR renders match
    document.cookie = `df_theme=${resolved}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  }, []);

  // Global keyboard shortcuts handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+D: Toggle dark mode
      if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setTheme((prev) => {
          const newTheme = prev === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
          localStorage.setItem('df_theme', newTheme);
          document.cookie = `df_theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax; Secure`;
          return newTheme;
        });
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if user is typing in an input
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      <div className="aurora-bg" />
      <div className="noise-overlay" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="fixed top-0 left-0 right-0 z-50 border-b glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Search"
            >
              ⌕
            </button>
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="rounded-lg px-2 py-2 text-sm font-bold text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              ?
            </button>
            <button
              type="button"
              onClick={() =>
                setTheme((t) => {
                  const next = t === 'dark' ? 'light' : 'dark';
                  document.documentElement.classList.toggle('dark', next === 'dark');
                  localStorage.setItem('df_theme', next);
                  document.cookie = `df_theme=${next}; path=/; max-age=31536000; SameSite=Lax; Secure`;
                  return next;
                })
              }
              className="rounded-lg px-2 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {!ready ? (
              <div className="skeleton h-9 w-24" />
            ) : hasSignedIn ? (
              <button type="button" onClick={openCompose} className="btn-primary">
                Compose
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="/api/auth/gotosocial/register"
                  className="rounded-lg border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/20 hover:shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                >
                  Get @degenfeed.xyz
                </a>
                <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {mobileOpen ? (
                <path
                  d="M15 5L5 15M5 5l10 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <path d="M3 6h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path
                    d="M3 10h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 14h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div
            className="border-t"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-glass-bg)' }}
          >
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile primary">
              {NAV.map((item) => (
                <NavLink key={item.href} item={item} onClick={closeMobile} />
              ))}
            </nav>
            <div className="border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
              {!ready ? (
                <div className="skeleton h-10 w-full" />
              ) : hasSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openCompose();
                  }}
                  className="btn-primary w-full"
                >
                  Compose
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openSignIn();
                  }}
                  className="btn-primary w-full"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="relative z-10 flex-1 pt-16 pb-20 lg:pb-0">
        {children}
      </main>

      <BottomNav />

      <footer
        className="relative z-10 hidden border-t py-8 lg:block"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-glass-bg)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-degen-500">◆</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              DegenFeed
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--color-muted)' }}>
            <a href="/feed" className="transition-colors hover:text-[var(--color-fg)]">
              Feed
            </a>
            <a href="/c" className="transition-colors hover:text-[var(--color-fg)]">
              Communities
            </a>
            <a href="/news" className="transition-colors hover:text-[var(--color-fg)]">
              News
            </a>
            <a href="/docs" className="transition-colors hover:text-[var(--color-fg)]">
              Docs
            </a>
            <a href="/premium" className="transition-colors hover:text-[var(--color-fg)]">
              Premium
            </a>
            <a href="/profile" className="transition-colors hover:text-[var(--color-fg)]">
              Profile
            </a>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-muted)' }}>
            <a href="/privacy" className="transition-colors hover:text-[var(--color-fg)]">
              Privacy
            </a>
            <a href="/terms" className="transition-colors hover:text-[var(--color-fg)]">
              Terms
            </a>
            <a
              href="/status"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--color-fg)]"
              title="Protocol health"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-degen-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
              <span>Status</span>
            </a>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            v{APP_VERSION} — © {new Date().getFullYear()} DegenFeed — a Rug Munch Media LLC product.
            No account required. Open source on{' '}
            <a
              href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-all hover:brightness-150"
              style={{ color: 'var(--color-muted)' }}
            >
              Forgejo
            </a>
            ,{' '}
            <a
              href="https://gitlab.com/cryptorugmuncher/degenfeed-web"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-all hover:brightness-150"
              style={{ color: 'var(--color-muted)' }}
            >
              GitLab
            </a>
            , and{' '}
            <a
              href="https://codeberg.org/cryptorugmunch/degenfeed-web"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-all hover:brightness-150"
              style={{ color: 'var(--color-muted)' }}
            >
              Codeberg
            </a>
            .
          </p>
        </div>
      </footer>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <OnboardingModal />
      <InstallPrompt />
      <AddToHomeScreenToast />
    </div>
  );
});

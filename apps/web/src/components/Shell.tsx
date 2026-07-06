'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: '/home', label: 'Feed' },
  { href: '/news', label: 'News' },
  { href: '/profile', label: 'Profile' },
];

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 group">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500 to-emerald-600 text-black text-lg font-bold shadow-[0_0_16px_rgba(34,197,94,0.35)] transition-shadow group-hover:shadow-[0_0_24px_rgba(34,197,94,0.5)]">
        ◆
      </span>
      <span className="text-lg font-bold tracking-tight text-white">DegenFeed</span>
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
        active ? 'text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {item.label}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
      )}
    </a>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, signedInProtocols, openSignIn, openCompose } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-gray-200">
      <div className="aurora-bg" />
      <div className="noise-overlay" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {!ready ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-800" />
            ) : hasSignedIn ? (
              <button type="button" onClick={openCompose} className="btn-primary">
                Compose
              </button>
            ) : (
              <button type="button" onClick={openSignIn} className="btn-primary">
                Connect Wallet
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
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
          <div className="border-t border-white/10 bg-gray-950/95 backdrop-blur-xl md:hidden">
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile primary">
              {NAV.map((item) => (
                <NavLink key={item.href} item={item} onClick={closeMobile} />
              ))}
            </nav>
            <div className="border-t border-white/10 p-4">
              {!ready ? (
                <div className="h-10 w-full animate-pulse rounded-lg bg-gray-800" />
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

      <main id="main" className="relative z-10 flex-1 pt-16">
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-gray-950/50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-degen-500">◆</span>
            <span className="text-sm font-semibold text-white">DegenFeed</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/home" className="transition-colors hover:text-white">
              Feed
            </a>
            <a href="/news" className="transition-colors hover:text-white">
              News
            </a>
            <a href="/profile" className="transition-colors hover:text-white">
              Profile
            </a>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} DegenFeed. No account required.
          </p>
        </div>
      </footer>
    </div>
  );
}

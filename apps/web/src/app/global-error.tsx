'use client';

/**
 * Next.js 13+ global error boundary.
 *
 * This file is required for the root error boundary — it catches errors
 * thrown OUTSIDE the layout scope (e.g. in _app/_document equivalent).
 * Unlike page error.tsx, this replaces the entire layout, so it needs its
 * own <html>/<body> tags.
 *
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorCode = `DF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  console.error(`[DegenFeed GlobalError ${errorCode}]`, error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          background: '#000',
          color: '#e7e9ea',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {/* Premium illustration */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                margin: '0 auto 24px',
                borderRadius: '20px',
                background: 'rgba(0, 255, 65, 0.08)',
                border: '1px solid rgba(0, 255, 65, 0.15)',
              }}
              aria-hidden="true"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="16" r="8" stroke="#00ff41" strokeWidth="1.5" opacity="0.5" />
                <path
                  d="M10 32c0-6 4-9 10-9s10 3 10 9"
                  stroke="#00ff41"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.4"
                />
                <path
                  d="M16 13l8 8M24 13l-8 8"
                  stroke="#00ff41"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </svg>
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
              }}
            >
              Critical error
            </h1>

            <p
              style={{
                fontSize: '0.875rem',
                lineHeight: '1.6',
                color: '#71767b',
                margin: '0 0 4px',
              }}
            >
              Something went very wrong. Our team has been notified.
            </p>

            <p
              style={{
                fontSize: '0.75rem',
                color: '#53575b',
                fontFamily: 'JetBrains Mono, monospace',
                margin: '0 0 24px',
                opacity: 0.5,
              }}
            >
              {errorCode}
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <button
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#000',
                  background: '#00ff41',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8a5 5 0 019.9-1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M13 3v4H9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Try Again
              </button>

              <a
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#71767b',
                  background: 'transparent',
                  border: '1px solid #2f3336',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  lineHeight: 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M1 8l7-6 7 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 6v7h3v-4h4v4h3V6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Go Home
              </a>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '40px',
                fontSize: '0.75rem',
                color: '#53575b',
              }}
            >
              <a
                href="/status"
                style={{
                  color: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  textDecorationStyle: 'dotted',
                }}
              >
                System Status
              </a>
              <span style={{ opacity: 0.3 }}>·</span>
              <a
                href="/faq"
                style={{
                  color: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  textDecorationStyle: 'dotted',
                }}
              >
                FAQ
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

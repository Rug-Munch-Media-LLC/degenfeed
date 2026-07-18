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
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            background: '#000',
            color: '#e7e9ea',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <span style={{ fontSize: '28px', color: '#f87171' }}>⚡</span>
            </div>

            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                margin: '0 0 8px',
                color: '#e7e9ea',
              }}
            >
              Critical error
            </h1>

            <p
              style={{
                fontSize: '14px',
                color: '#71717a',
                margin: '0 0 24px',
                lineHeight: 1.5,
              }}
            >
              A critical error occurred. Our team has been automatically notified.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'rgba(34,197,94,0.2)',
                  color: '#4ade80',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  width: '100%',
                }}
              >
                Try Again
              </button>

              <a
                href="/"
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: '#a1a1aa',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  width: '100%',
                  boxSizing: 'border-box' as const,
                  textAlign: 'center' as const,
                }}
              >
                Go Home
              </a>
            </div>

            <p
              style={{
                marginTop: '24px',
                fontSize: '11px',
                fontFamily: 'ui-monospace, monospace',
                color: '#52525b',
                letterSpacing: '0.5px',
              }}
            >
              {errorCode}
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

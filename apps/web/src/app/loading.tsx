// Root loading state — minimal flash. Shows header + subtle pulse.
// Matches the new landing page design to avoid jarring transitions.

function LoadingLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="36"
      height="36"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d0d0d" />
          <stop offset="100%" stopColor="#000000" />
        </linearGradient>
        <linearGradient id="ld" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d9bf0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#lb)" rx="96" />
      <g
        stroke="url(#ld)"
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <line x1="160" y1="92" x2="160" y2="420" />
        <path d="M 160 92 A 148 164 0 0 1 160 420" />
      </g>
      <circle cx="230" cy="256" r="100" fill="#1d9bf0" opacity="0.08" />
    </svg>
  );
}

export default function RootLoading() {
  return (
    <>
      {/* Inline minimal theme to prevent FOUC */}
      <style>{`
        :root {
          --bg: #000000; --surface: #070707; --card: #0d0d0d;
          --border: #1a1a1a; --fg: #e7e9ea; --fg-secondary: #a0a0a0;
          --fg-tertiary: #606060; --accent: #1d9bf0;
          --font-heading: 'Syne', 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
        }
        .loading-header {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }
        .loading-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 20px;
          height: 64px; display: flex; align-items: center; justify-content: space-between;
        }
        .loading-brand {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--font-heading); font-weight: 800; font-size: 20px; color: var(--fg);
        }
        .loading-scanline {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
        }
        .loading-pulse {
          width: 60px; height: 60px; border-radius: 50%;
          border: 3px solid var(--border); border-top-color: var(--accent);
          animation: spin 0.8s linear infinite;
          position: fixed; top: 50%; left: 50%; margin: -30px 0 0 -30px;
          z-index: 100;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .loading-pulse { animation: none; } }
      `}</style>
      <div className="loading-scanline" aria-hidden="true" />
      <header className="loading-header">
        <div className="loading-inner">
          <div className="loading-brand">
            <LoadingLogo />
            <span>DegenFeed</span>
          </div>
        </div>
      </header>
      <div className="loading-pulse" role="status" aria-label="Loading" />
    </>
  );
}

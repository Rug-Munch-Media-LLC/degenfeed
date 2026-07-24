// === Animation Keyframes & Tiny Shared Components ===
// Auto-extracted from page.tsx

export const ANIM_STYLES = `
@keyframes waveform {
  0%, 100% { transform: scaleY(0.25); }
  50% { transform: scaleY(1); }
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
  70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
`;

export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative flex h-2.5 w-2.5 items-center justify-center ${className}`}
      role="img"
      aria-label="Live"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

export function Waveform({ className = '' }: { className?: string }) {
  const bars = [12, 20, 14, 22, 16, 18];
  return (
    <span className={`inline-flex items-end gap-[2px] ${className}`} aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-degen-500/70"
          style={{
            height: `${h}%`,
            animation: `waveform 0.9s ease-in-out ${i * 0.12}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </span>
  );
}

export function SpacesIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-degen-500"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

'use client';

/**
 * Double-tap heart burst animation overlay
 */
export function HeartBurst({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      {/* Central heart */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="#ff2d55"
        className="drop-shadow-[0_0_30px_rgba(255,45,85,0.6)]"
        style={{ animation: 'shorts-heart-pop 0.8s ease-out forwards' }}
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {/* Orbiting hearts */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * 360;
        return (
          <svg
            key={i}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#ff2d55"
            className="absolute drop-shadow-[0_0_12px_rgba(255,45,85,0.4)]"
            style={
              {
                animation: `shorts-heart-orbit 0.8s ease-out forwards`,
                animationDelay: `${i * 0.05}s`,
                transformOrigin: 'center',
                '--angle': `${angle}deg`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        );
      })}
    </div>
  );
}

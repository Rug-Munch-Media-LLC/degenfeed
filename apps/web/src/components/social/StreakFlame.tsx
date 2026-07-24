'use client';

/**
 * StreakFlame — Animated flame icon for daily streaks.
 * Shows a flickering fire animation with configurable intensity based on streak length.
 */

interface StreakFlameProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
}

export function StreakFlame({ streak, size = 'md' }: StreakFlameProps) {
  const sizeMap = { sm: 16, md: 22, lg: 32 };
  const px = sizeMap[size];

  return (
    <div
      className="relative inline-flex items-center gap-1"
      title={`${streak}-day streak! 🔥`}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-streak-flame"
        style={{ transformOrigin: 'center' }}
      >
        <defs>
          <linearGradient id="flame-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C9 7 4 11 4 14.5C4 18.09 7.58 21 12 21C16.42 21 20 18.09 20 14.5C20 11 15 7 12 2Z"
          fill="url(#flame-grad)"
          stroke="#ea580c"
          strokeWidth="0.5"
        />
        <path
          d="M12 17C14.21 17 16 15.43 16 13.5C16 12 14.5 10.5 12 8C9.5 10.5 8 12 8 13.5C8 15.43 9.79 17 12 17Z"
          fill="#fef08a"
          opacity="0.6"
        />
      </svg>
      {streak > 0 && (
        <span className="text-xs font-black tabular-nums" style={{ color: '#f59e0b' }}>
          {streak}
        </span>
      )}
    </div>
  );
}

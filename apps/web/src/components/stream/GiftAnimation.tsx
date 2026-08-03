'use client';

/**
 * @degenfeed/web — Gift Animation Overlay
 *
 * Full-screen and in-player gift animations for live streams.
 * Each gift type has a unique animation sequence:
 *   🌹 Rose      — Petal shower
 *   🎈 Balloon   — Floating balloons
 *   💎 Diamond   — Sparkle burst
 *   🚀 Rocket    — Rocket fly-through
 *   👑 Crown     — Crown placement with fanfare
 *   🐳 Whale     — Whale breach with splash
 *
 * Streak bonuses stack on top of the base animation.
 */

import { useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface GiftAnimationEvent {
  giftTypeId: string;
  icon: string;
  name: string;
  tier: number;
  sats: number;
  usd: number;
  isFullScreenAnimation: boolean;
  animationClass: string;
  animationDurationSec: number;
  senderLabel: string;
  isAnonymous: boolean;
  isPackage?: boolean;
  packageLabel?: string;
  streak?: {
    count: number;
    label: string;
    animationBonus: string;
  };
  creatorLabel?: string;
}

interface GiftAnimationProps {
  event: GiftAnimationEvent;
  onComplete: () => void;
}

// ─── Particle Generators ─────────────────────────────────────────────────


// ─── Gift Animations ─────────────────────────────────────────────────────

function RoseAnimation({ duration }: { duration: number }) {
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; scale: number }>
  >([]);
  const areaRef = useRef({ w: typeof window !== 'undefined' ? window.innerWidth : 800, h: 600 });

  useEffect(() => {
    const petals = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * areaRef.current.w,
      y: -20 - Math.random() * 100,
      scale: 0.3 + Math.random() * 0.7,
    }));
    setParticles(petals);

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          y: p.y + 2 + Math.random() * 3,
          x: p.x + (Math.random() - 0.5) * 2,
        })),
      );
    }, 50);

    const timer = setTimeout(() => clearInterval(interval), duration * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <div className="absolute bottom-1/4 left-1/2 z-10 -translate-x-1/2 text-6xl animate-bounce">
        🌹
      </div>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-xs opacity-70"
          style={{
            left: p.x,
            top: p.y,
            transform: `scale(${p.scale})`,
            transition: 'all 0.05s linear',
          }}
        >
          🌹
        </span>
      ))}
    </div>
  );
}

function BalloonAnimation({ duration }: { duration: number }) {
  const [balloons, setBalloons] = useState<
    Array<{ id: number; x: number; y: number; color: string }>
  >([]);

  useEffect(() => {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA'];
    const initial = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800),
      y: (typeof window !== 'undefined' ? window.innerHeight : 600) + 50 + Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setBalloons(initial);

    const interval = setInterval(() => {
      setBalloons((prev) =>
        prev.map((b) => ({
          ...b,
          y: b.y - 1.5 - Math.random() * 2,
          x: b.x + (Math.random() - 0.5) * 1.5,
        })),
      );
    }, 30);

    const timer = setTimeout(() => clearInterval(interval), duration * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <div className="absolute bottom-1/3 left-1/2 z-10 -translate-x-1/2 text-6xl animate-bounce">
        🎈
      </div>
      {balloons.map((b) => (
        <span
          key={b.id}
          className="absolute text-3xl opacity-60"
          style={{
            left: b.x,
            top: b.y,
            transition: 'all 0.03s linear',
          }}
        >
          🎈
        </span>
      ))}
    </div>
  );
}

function DiamondAnimation({ duration }: { duration: number }) {
  const [sparkles, setSparkles] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);

  useEffect(() => {
    const particles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x:
        (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 + (Math.random() - 0.5) * 400,
      y:
        (typeof window !== 'undefined' ? window.innerHeight : 600) / 2 +
        (Math.random() - 0.5) * 300,
      delay: Math.random() * 0.5,
    }));
    setSparkles(particles);

    const timer = setTimeout(() => setSparkles([]), duration * 1000);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <div className="absolute left-1/2 top-1/3 z-10 -translate-x-1/2 -translate-y-1/2">
        <span className="inline-block text-7xl animate-pulse" style={{ animationDuration: '0.5s' }}>
          💎
        </span>
      </div>
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="absolute text-lg"
          style={{
            left: s.x,
            top: s.y,
            animation: `sparkle 0.6s ease-out ${s.delay}s both`,
          }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

function RocketAnimation({ duration }: { duration: number }) {
  const [rocketY, setRocketY] = useState(600);

  useEffect(() => {
    const startY = (typeof window !== 'undefined' ? window.innerHeight : 600) + 100;
    setRocketY(startY);

    const interval = setInterval(() => {
      setRocketY((prev) => {
        if (prev < -200) return -200;
        return prev - 8;
      });
    }, 30);

    const timer = setTimeout(() => {
      clearInterval(interval);
    }, duration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {/* Trail */}
      <div
        className="absolute left-1/2 z-0 h-32 w-4 -translate-x-1/2 bg-gradient-to-t from-orange-500 via-red-500 to-transparent blur-md"
        style={{ top: rocketY + 50, opacity: rocketY > -100 ? 0.8 : 0 }}
      />
      {/* Rocket */}
      <span className="absolute left-1/2 z-10 -translate-x-1/2 text-6xl" style={{ top: rocketY }}>
        🚀
      </span>
      {/* Smoke particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-sm opacity-40"
          style={{
            left: `calc(50% + ${(Math.random() - 0.5) * 60}px)`,
            top: rocketY + 60 + Math.random() * 40,
            animation: `fadeOut 1s ease-out ${Math.random() * 0.5}s both`,
          }}
        >
          💨
        </span>
      ))}
    </div>
  );
}

function CrownAnimation({ duration }: { duration: number }) {
  const [showCrown, setShowCrown] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    setShowCrown(true);

    // Fanfare particles
    const p = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      const radius = 100 + Math.random() * 200;
      return {
        id: i,
        x: (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 + Math.cos(angle) * radius,
        y:
          (typeof window !== 'undefined' ? window.innerHeight : 600) / 2 + Math.sin(angle) * radius,
      };
    });
    setParticles(p);

    const timer = setTimeout(() => {
      setShowCrown(false);
      setParticles([]);
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
      {showCrown && (
        <>
          {/* Crown glow */}
          <div className="absolute h-40 w-40 rounded-full bg-yellow-400/20 blur-3xl animate-ping" />
          <span
            className="relative z-10 text-8xl animate-bounce"
            style={{ animationDuration: '0.8s' }}
          >
            👑
          </span>
          {/* Fanfare */}
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute text-xl"
              style={{
                left: p.x,
                top: p.y,
                animation: 'sparkle 0.8s ease-out both',
              }}
            >
              ✨
            </span>
          ))}
        </>
      )}
      {/* Announcement text */}
      {showCrown && (
        <div className="absolute bottom-1/4 left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="text-lg font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(255,200,0,0.5)] animate-pulse">
            👑 CROWN! 👑
          </div>
        </div>
      )}
    </div>
  );
}

function WhaleAnimation({ duration }: { duration: number }) {
  const [splash, setSplash] = useState(true);
  const [whaleY, setWhaleY] = useState(800);

  useEffect(() => {
    const targetY = (typeof window !== 'undefined' ? window.innerHeight : 600) / 2 - 100;

    const interval = setInterval(() => {
      setWhaleY((prev) => {
        if (prev <= targetY) {
          clearInterval(interval);
          setSplash(false);
          // Second launch after a brief pause
          setTimeout(() => {
            setSplash(true);
            setWhaleY(800);
          }, 600);
          return targetY;
        }
        return prev - 10;
      });
    }, 25);

    const timer = setTimeout(() => {
      clearInterval(interval);
    }, duration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {/* Splash effect */}
      {splash && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-32 bg-gradient-to-t from-blue-500/30 to-transparent animate-pulse" />
        </div>
      )}
      {/* Whale */}
      <span
        className="absolute left-1/2 z-10 -translate-x-1/2 text-8xl"
        style={{
          top: whaleY,
          transition: 'top 0.025s linear',
          transform: `translateX(-50%) ${whaleY < 300 ? 'rotate(-20deg)' : ''}`,
        }}
      >
        🐳
      </span>
      {/* Water droplets */}
      {splash &&
        Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute text-sm"
            style={{
              left: `${Math.random() * 100}%`,
              bottom: `${Math.random() * 40}%`,
              animation: `fadeOut 1s ease-out ${Math.random() * 0.5}s both`,
            }}
          >
            💦
          </span>
        ))}
      {/* Announcement */}
      {whaleY < 400 && (
        <div className="absolute left-1/2 top-10 z-20 -translate-x-1/2 text-center">
          <div className="text-2xl font-extrabold text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] animate-pulse">
            🐳 WHALE! 🐳
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Streak Bonus Overlay ─────────────────────────────────────────────────

function StreakBonus({ streak }: { streak: NonNullable<GiftAnimationEvent['streak']> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
      <div className="animate-bounce text-center" style={{ animationDuration: '0.5s' }}>
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/40 via-red-500/40 to-purple-500/40 px-8 py-4 backdrop-blur-md border border-white/20">
          <div className="text-3xl font-black text-white drop-shadow-[0_0_15px_rgba(255,200,0,0.5)]">
            {streak.label}
          </div>
          <div className="mt-1 text-sm text-white/80">{streak.count} gifts in a row!</div>
        </div>
      </div>
    </div>
  );
}

// ─── Sender Label ────────────────────────────────────────────────────────

function GiftSenderLabel({ event }: { event: GiftAnimationEvent }) {
  return (
    <div className="pointer-events-none absolute bottom-32 left-1/2 z-[55] -translate-x-1/2 text-center">
      <div className="animate-fade-in-up">
        <div className="rounded-xl bg-gradient-to-r from-purple-600/40 to-pink-600/40 px-6 py-3 backdrop-blur-md border border-white/10 shadow-2xl">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-white">
            <span>{event.senderLabel}</span>
            <span>sent</span>
            <span className="text-2xl">{event.icon}</span>
            {event.isAnonymous && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/60">
                Anonymous
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-white/60">
            {event.isPackage ? `${event.packageLabel} — ` : ''}${event.usd.toFixed(2)} (
            {event.sats.toLocaleString()} sats)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────

const ANIMATION_MAP: Record<string, React.FC<{ duration: number }>> = {
  rose: RoseAnimation,
  balloon: BalloonAnimation,
  diamond: DiamondAnimation,
  rocket: RocketAnimation,
  crown: CrownAnimation,
  whale: WhaleAnimation,
};

export function GiftAnimationOverlay({ event, onComplete }: GiftAnimationProps) {
  const [visible, setVisible] = useState(true);
  const [showStreak, setShowStreak] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Show streak bonus after brief delay
    if (event.streak) {
      streakTimerRef.current = setTimeout(() => {
        setShowStreak(true);
      }, 400);
    }

    // Auto-dismiss
    timerRef.current = setTimeout(
      () => {
        setVisible(false);
        setShowStreak(false);
        onComplete();
      },
      event.animationDurationSec * 1000 + 500,
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
    };
  }, [event, onComplete]);

  if (!visible) return null;

  const AnimationComponent = ANIMATION_MAP[event.giftTypeId];

  return (
    <>
      {/* Base animation */}
      {AnimationComponent && <AnimationComponent duration={event.animationDurationSec} />}

      {/* Fallback for unknown gift types */}
      {!AnimationComponent && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <span className="text-8xl animate-bounce">{event.icon}</span>
        </div>
      )}

      {/* Sender label */}
      <GiftSenderLabel event={event} />

      {/* Streak bonus */}
      {showStreak && event.streak && <StreakBonus streak={event.streak} />}
    </>
  );
}

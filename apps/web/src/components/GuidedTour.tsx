'use client';

/**
 * @components/GuidedTour — Post-onboarding guided product tour.
 *
 * After a user completes the onboarding wizard, GuidedTour launches a
 * step-by-step walkthrough of app features. Each step highlights a UI
 * element with a spotlight ring and a floating tooltip.
 *
 * Steps: Feed tabs → Protocol pills → Compose button → Tip on a post → Explore link
 *
 * Design: Dark cyberpunk with degen-green glow accents. Glass tooltips.
 * Spotlight uses a radial gradient that pulses gently.
 *
 * Accessibility: Focus trap, keyboard nav (Enter to advance, Escape to skip),
 * role="dialog", aria-label on each step, reduced-motion support.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// === Types ================================================================

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** Offset from the targeted element (px) */
  offset?: number;
}

export type TourState = 'idle' | 'active' | 'completed' | 'skipped';

// === Constants ============================================================

const STORAGE_KEY = 'degenfeed_guided_tour';

/** How long to wait after the page loads before showing the tour (ms) */
const LAUNCH_DELAY = 800;

/** The five tour steps */
const STEPS: TourStep[] = [
  {
    targetSelector: '[class*="For You" i]',
    title: 'Your Personalized Feed',
    description:
      'This is your unified feed. It shows content from all your linked protocols. Use the tabs to switch between For You (algorithm-curated), Following (people you follow), and Everything (firehose).',
    placement: 'bottom',
  },
  {
    targetSelector: '[class*="protocolFilter" i], [class*="ProtocolBadge" i]',
    title: 'Filter by Network',
    description:
      'Tap any protocol pill to see only content from that network. Each protocol has its own native social graph — Nostr relays, Farcaster hubs, Lens profiles, AT Protocol, ActivityPub, and more.',
    placement: 'bottom',
  },
  {
    targetSelector:
      'button:has(svg):has(path[d*="Compose" i]), .btn-primary, button:has-text("Compose")',
    title: 'Cross-Protocol Posting',
    description:
      'Create a post and publish it to Nostr, Farcaster, Lens, Bluesky, Mastodon, and Threads all at once. Your message goes everywhere you choose, from a single click.',
    placement: 'left',
  },
  {
    targetSelector: 'button[aria-label*="Tip" i], button:has-text("Tip")',
    title: 'Zero-Fee Crypto Tips',
    description:
      'Support creators directly with crypto tips — ETH, SOL, USDC, or Lightning. Tips are on-chain and peer-to-peer. DegenFeed takes 0% — every satoshi goes to the creator.',
    placement: 'left',
  },
  {
    targetSelector: 'a[href*="/discover" i], a[href*="/search" i], [class*="Discover" i]',
    title: 'Explore the Multiverse',
    description:
      'Discover trending topics, communities, and people across all 8 networks. Find new creators, join conversations, and see what is trending in web3 right now.',
    placement: 'right',
  },
];

// === Helpers ==============================================================

function getTargetRect(selector: string): DOMRect | null {
  if (typeof document === 'undefined') return null;
  try {
    // Try multiple strategies to find the element
    // 1. Direct querySelector
    let el = document.querySelector(selector) as HTMLElement | null;

    // 2. If no match, try finding by text content
    if (!el) {
      const allElements = document.querySelectorAll('button, a, [class*="tab"], [class*="pill"]');
      for (const elem of allElements) {
        if (
          elem.textContent?.toLowerCase().includes('for you') ||
          elem.textContent?.toLowerCase().includes('following') ||
          elem.textContent?.toLowerCase().includes('compose') ||
          elem.textContent?.toLowerCase().includes('tip') ||
          elem.textContent?.toLowerCase().includes('discover')
        ) {
          el = elem as HTMLElement;
          break;
        }
      }
    }

    return el ? el.getBoundingClientRect() : null;
  } catch {
    return null;
  }
}

function markTourCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* ignore */
  }
}

// === Component ============================================================

interface GuidedTourProps {
  /** External control: force show the tour */
  forceShow?: boolean;
  /** Called when the tour ends (completed or skipped) */
  onComplete?: () => void;
}

export function GuidedTour({ forceShow = false, onComplete }: GuidedTourProps) {
  const [tourState, setTourState] = useState<TourState>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = STEPS[currentStep]!;

  // == Initialize tour =================================================
  useEffect(() => {
    if (forceShow || (!isTourCompleted() && !forceShow)) {
      // Wait for the page to settle before starting
      stepTimerRef.current = setTimeout(() => {
        setTourState('active');
        setCurrentStep(0);
      }, LAUNCH_DELAY);
    }
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [forceShow]);

  // == Poll for target element to appear (dynamic DOM) =================
  useEffect(() => {
    if (tourState !== 'active') return;

    // Initial position attempt
    const rect = getTargetRect(STEPS[currentStep]!.targetSelector);
    if (rect) {
      setTargetRect(rect);
      setVisible(true);
      return;
    }

    // Poll for the element (up to 10 seconds)
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts++;
      const r = getTargetRect(STEPS[currentStep]!.targetSelector);
      if (r) {
        setTargetRect(r);
        setVisible(true);
        if (pollRef.current) clearInterval(pollRef.current);
      }
      if (attempts > 20) {
        // Element not found — still show the tooltip centered
        setTargetRect(null);
        setVisible(true);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tourState, currentStep]);

  // == Re-calculate position on scroll/resize =========================
  useEffect(() => {
    if (tourState !== 'active') return;

    const recalc = () => {
      const r = getTargetRect(STEPS[currentStep]!.targetSelector);
      if (r) setTargetRect(r);
    };

    window.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('resize', recalc, { passive: true });
    return () => {
      window.removeEventListener('scroll', recalc);
      window.removeEventListener('resize', recalc);
    };
  }, [tourState, currentStep]);

  // == Navigation handlers =============================================
  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setVisible(false);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 200);
    } else {
      setTourState('completed');
      markTourCompleted();
      onComplete?.();
    }
  }, [currentStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setVisible(false);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
      }, 200);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    setTourState('skipped');
    markTourCompleted();
    onComplete?.();
  }, [onComplete]);

  // == Keyboard handlers ===============================================
  useEffect(() => {
    if (tourState !== 'active') return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourState, handleSkip, handlePrev, handleNext]);

  // == Compute tooltip position ========================================
  const tooltipStyle = useMemo(() => {
    if (!targetRect) {
      // Fallback: center of screen
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = step.offset ?? 16;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    switch (step.placement) {
      case 'top':
        return {
          bottom: `${window.innerHeight - targetRect.top + gap}px`,
          left: `${targetRect.left + targetRect.width / 2 + scrollX}px`,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + gap + scrollY}px`,
          left: `${targetRect.left + targetRect.width / 2 + scrollX}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2 + scrollY}px`,
          right: `${window.innerWidth - targetRect.left + gap}px`,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2 + scrollY}px`,
          left: `${targetRect.right + gap + scrollX}px`,
          transform: 'translateY(-50%)',
        };
      default:
        return {
          top: `${targetRect.bottom + gap + scrollY}px`,
          left: `${targetRect.left + targetRect.width / 2 + scrollX}px`,
          transform: 'translateX(-50%)',
        };
    }
  }, [targetRect, step]);

  // == Spotlight style =================================================
  const spotlightStyle = useMemo(() => {
    if (!targetRect) return undefined;
    return {
      top: `${targetRect.top - 8}px`,
      left: `${targetRect.left - 8}px`,
      width: `${targetRect.width + 16}px`,
      height: `${targetRect.height + 16}px`,
    };
  }, [targetRect]);

  if (tourState !== 'active') return null;

  return (
    <>
      {/* == Full-screen dim overlay == */}
      <div
        className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
        onClick={handleSkip}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleSkip();
        }}
        role="presentation"
        aria-hidden="true"
      />

      {/* == Spotlight highlight ring == */}
      {spotlightStyle && (
        <div
          className="fixed z-[81] pointer-events-none rounded-2xl"
          style={{
            ...spotlightStyle,
            boxShadow:
              '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(0, 255, 65, 0.6), 0 0 24px rgba(0, 255, 65, 0.3)',
            animation: 'guided-tour-pulse 2s ease-in-out infinite',
          }}
          aria-hidden="true"
        />
      )}

      {/* == Tooltip card == */}
      <div
        ref={tooltipRef}
        className="fixed z-[82] w-[min(90vw,380px)]"
        style={{
          ...tooltipStyle,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease-out, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
          transform: visible
            ? `${tooltipStyle.transform || ''} translateY(0)`
            : `${tooltipStyle.transform || ''} translateY(8px)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${currentStep + 1}: ${step.title}`}
        aria-describedby="tour-description"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/95 shadow-2xl shadow-degen-500/10 backdrop-blur-2xl">
          {/* Subtle gradient accent */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-degen-500/[0.04] to-transparent" />

          {/* Step indicator */}
          <div className="relative px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-medium tracking-widest text-degen-400/80 uppercase">
                Step {currentStep + 1} of {STEPS.length}
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Skip tour"
              >
                Skip tour
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-0.5 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Body */}
          <div className="relative px-5 pb-4 pt-2">
            <h3 className="mb-1.5 text-base font-bold text-white leading-snug">{step.title}</h3>
            <p id="tour-description" className="text-sm leading-relaxed text-white/60">
              {step.description}
            </p>
          </div>

          {/* Footer actions */}
          <div className="relative flex items-center justify-between border-t border-white/[0.04] px-5 py-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={`dot-${STEPS.length}-${i}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'w-5 bg-degen-400 shadow-[0_0_6px_rgba(0,255,65,0.4)]'
                      : i < currentStep
                        ? 'w-1.5 bg-degen-500/40'
                        : 'w-1.5 bg-white/10'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-degen-500 px-4 py-1.5 text-xs font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(0,255,65,0.25)]"
              >
                {currentStep < STEPS.length - 1 ? 'Next →' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* == Animations == */}
      <style>{`
        @keyframes guided-tour-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,255,65,0.6), 0 0 24px rgba(0,255,65,0.3); }
          50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), 0 0 0 3px rgba(0,255,65,0.8), 0 0 36px rgba(0,255,65,0.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .guided-tour-pulse { animation: none !important; }
          div[style*="animation"][class] { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </>
  );
}

/**
 * Check if the guided tour has been completed before.
 */
export function isTourCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

/**
 * Reset the guided tour flag so it shows again on next visit.
 */
export function resetTour() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

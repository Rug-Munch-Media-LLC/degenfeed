'use client';

import { useCallback, useReducer, useState } from 'react';

interface ProfileWizardState {
  step: number;
  avatar: string | null;
  displayName: string;
  bio: string;
  interests: string[];
  error: string | null;
  saving: boolean;
}

const INITIAL: ProfileWizardState = {
  step: 1,
  avatar: null,
  displayName: '',
  bio: '',
  interests: [],
  error: null,
  saving: false,
};

type Action =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_FIELD'; field: string; value: string }
  | { type: 'SET_AVATAR'; avatar: string | null }
  | { type: 'TOGGLE_INTEREST'; interest: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_SAVING'; saving: boolean };

function reducer(state: ProfileWizardState, action: Action): ProfileWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null };
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value, error: null };
    case 'SET_AVATAR':
      return { ...state, avatar: action.avatar };
    case 'TOGGLE_INTEREST': {
      const set = new Set(state.interests);
      if (set.has(action.interest)) set.delete(action.interest);
      else if (set.size < 10) set.add(action.interest);
      return { ...state, interests: Array.from(set) };
    }
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    default:
      return state;
  }
}

const NICHES = [
  'crypto',
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'nft',
  'ai',
  'regulation',
  'security',
  'macro',
  'stablecoin',
  'etf',
  'layer2',
  'memecoin',
  'onchain',
  'gaming',
  'social',
  'privacy',
];

interface ProfileSetupWizardProps {
  onComplete: (profile: {
    displayName: string;
    avatar: string | null;
    interests: string[];
  }) => void;
  onClose: () => void;
}

export function ProfileSetupWizard({ onComplete, onClose }: ProfileSetupWizardProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      dispatch({ type: 'SET_ERROR', error: 'Image must be under 5MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      dispatch({ type: 'SET_AVATAR', avatar: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(async () => {
    dispatch({ type: 'SET_SAVING', saving: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: state.displayName,
          avatar: state.avatar,
          bio: state.bio,
          interests: state.interests,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to save profile');
      }
      onComplete({
        displayName: state.displayName || 'anon',
        avatar: state.avatar,
        interests: state.interests,
      });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error:
          err instanceof Error ? err.message : 'Failed to save. You can update later in Settings.',
      });
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  }, [state.displayName, state.avatar, state.bio, state.interests, onComplete]);

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return true; // Avatar is optional
      case 2:
        return state.displayName.trim().length >= 1;
      case 3:
        return true; // Interests are optional
      default:
        return true;
    }
  };

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set up your profile"
        className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  s <= state.step
                    ? 'bg-degen-500 text-black'
                    : 'bg-[var(--color-muted)] text-[var(--color-muted)]'
                }`}
              >
                {s < state.step ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-6 transition-all ${s < state.step ? 'bg-degen-500' : 'bg-[var(--color-muted)]'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Avatar */}
        {state.step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">Choose your avatar</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Upload a profile picture or skip for now.
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)]">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-[var(--color-muted)]">👤</span>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-degen-500 text-xs font-bold text-black hover:bg-degen-400 transition-colors">
                  +
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarPreview(null);
                    dispatch({ type: 'SET_AVATAR', avatar: null });
                  }}
                  className="text-xs text-red-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Display Name */}
        {state.step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">What should we call you?</h2>
            <p className="text-sm text-[var(--color-muted)]">
              This is how others will see you on DegenFeed.
            </p>
            <input
              type="text"
              value={state.displayName}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'displayName', value: e.target.value })
              }
              placeholder="Your display name"
              className="input w-full text-base"
              maxLength={64}
            />
          </div>
        )}

        {/* Step 3: Interests */}
        {state.step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">What are you into?</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Pick topics you care about. We'll tailor your feed.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NICHES.map((niche) => {
                const selected = state.interests.includes(niche);
                return (
                  <button
                    key={niche}
                    type="button"
                    onClick={() => dispatch({ type: 'TOGGLE_INTEREST', interest: niche })}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      selected
                        ? 'bg-degen-500 text-black'
                        : 'bg-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
                    }`}
                  >
                    {niche}
                  </button>
                );
              })}
            </div>
            {state.interests.length > 0 && (
              <p className="text-[10px] text-[var(--color-muted)]">
                {state.interests.length}/10 selected
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {state.error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">
            {state.error}
          </p>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {state.step > 1 ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_STEP', step: state.step - 1 })}
              className="rounded-lg bg-[var(--color-muted)] px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[var(--color-muted)] px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Skip all
            </button>
          )}
          {state.step < 3 ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_STEP', step: state.step + 1 })}
              disabled={!canProceed(state.step)}
              className="rounded-lg bg-degen-500 px-5 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)] disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={state.saving}
              className="rounded-lg bg-degen-500 px-5 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)] disabled:opacity-40"
            >
              {state.saving ? 'Saving...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Dispatch a custom event to trigger the profile wizard.
 * Called after first sign-in when onboarding is not yet complete.
 */
export function triggerProfileWizard() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('df-open-profile-wizard'));
}

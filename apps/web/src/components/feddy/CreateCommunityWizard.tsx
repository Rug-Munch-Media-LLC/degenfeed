'use client';

import { useCallback, useState } from 'react';
import { CATEGORY_EMOJIS, CATEGORY_LABELS, type FeddyCategory } from './types';

// ─── Step definitions ──────────────────────────────────────────────────

const STEPS = ['Name', 'Details', 'Rules', 'Appearance', 'Review'] as const;

type Step = (typeof STEPS)[number];

const STEP_ICONS: Record<Step, string> = {
  Name: '📝',
  Details: 'ℹ️',
  Rules: '📜',
  Appearance: '🎨',
  Review: '✅',
};

// ─── Validation helpers ────────────────────────────────────────────────

function validateName(name: string): string | null {
  const cleaned = name.toLowerCase().trim();
  if (!cleaned) return 'Community name is required';
  if (cleaned.length < 3) return 'Community name must be at least 3 characters';
  if (cleaned.length > 30) return 'Community name must be at most 30 characters';
  if (!/^[a-z0-9-]+$/.test(cleaned)) return 'Use only lowercase letters, numbers, and hyphens';
  if (cleaned.startsWith('-') || cleaned.endsWith('-')) return 'Name cannot start or end with a hyphen';
  if (/--/.test(cleaned)) return 'Name cannot contain consecutive hyphens';
  return null;
}

// ─── Step 1: Name ──────────────────────────────────────────────────────

function StepName({
  name,
  onChange,
  error,
  checking,
}: {
  name: string;
  onChange: (name: string) => void;
  error: string | null;
  checking: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
        <p className="text-xs text-purple-400">
          Your community will be accessible at{' '}
          <span className="font-mono font-bold">degenfeed.xyz/feddy/{name || 'your-name'}</span>{' '}
          and federate via{' '}
          <span className="font-mono font-bold">@{name || 'your-name'}@communities.degenfeed.xyz</span>
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Community Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder="crypto-artists"
          maxLength={30}
          className={`w-full rounded-xl border bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none transition-all focus:ring-1 ${
            error
              ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
              : 'border-[var(--color-border)] focus:border-degen-500/40 focus:ring-degen-500/20'
          }`}
          autoFocus
        />
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[10px] text-[var(--color-muted)]">
            3-30 lowercase letters, numbers, and hyphens
          </p>
          {checking && <span className="text-[10px] text-degen-400">Checking availability...</span>}
        </div>
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>

      {/* Handle preview */}
      {name && !error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted)] mb-2">Your community handle:</p>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2">
            <span className="text-sm">🌐</span>
            <span className="font-mono text-sm text-degen-400">
              @{name}@communities.degenfeed.xyz
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
            Follow this handle from any Mastodon/Fediverse app
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Details ───────────────────────────────────────────────────

function StepDetails({
  displayName,
  description,
  category,
  tags,
  linkedCoin,
  onChange,
}: {
  displayName: string;
  description: string;
  category: FeddyCategory;
  tags: string;
  linkedCoin: string;
  onChange: (field: string, value: string) => void;
}) {
  const categories = Object.entries(CATEGORY_LABELS) as [FeddyCategory, string][];

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => onChange('displayName', e.target.value)}
          placeholder="Crypto Artists Collective"
          maxLength={100}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="A community for crypto artists to share their work, collaborate, and discuss NFTs, generative art, and on-chain creativity."
          rows={4}
          maxLength={2000}
          className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">{description.length}/2000</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">Category</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categories.map(([cat, label]) => (
            <button
              key={cat}
              type="button"
              onClick={() => onChange('category', cat)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                category === cat
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-400'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              <span>{CATEGORY_EMOJIS[cat]}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Tags <span className="text-[var(--color-muted)]">(comma separated)</span>
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => onChange('tags', e.target.value)}
          placeholder="crypto, art, nft, generative"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Linked Creator Coin <span className="text-[var(--color-muted)]">(optional)</span>
        </label>
        <input
          type="text"
          value={linkedCoin}
          onChange={(e) => onChange('linkedCoin', e.target.value)}
          placeholder="Token contract address"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          Link a creator coin to this community. Holders get special badges.
        </p>
      </div>
    </div>
  );
}

// ─── Step 3: Rules ─────────────────────────────────────────────────────

function StepRules({
  rulesText,
  onChange,
}: {
  rulesText: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-xs text-amber-400">
          Set clear rules for your community. These will be displayed on your community page.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Community Rules <span className="text-[var(--color-muted)]">(one per line)</span>
        </label>
        <textarea
          value={rulesText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="No spam or self-promotion&#10;Be respectful to all members&#10;Stay on topic&#10;No harassing or bullying&#10;Follow the platform ToS"
          rows={8}
          maxLength={5000}
          className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
      </div>

      {/* Preview */}
      {rulesText.trim() && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="mb-2 text-xs font-bold text-[var(--color-fg)] uppercase tracking-wider">
            Preview
          </p>
          <ol className="space-y-2">
            {rulesText.split('\n').filter((r) => r.trim()).map((rule, i) => (
              <li key={i} className="flex gap-2 text-xs text-[var(--color-muted)]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-degen-500/15 text-[8px] font-bold text-degen-400">
                  {i + 1}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Appearance ────────────────────────────────────────────────

function StepAppearance({
  avatarUrl,
  bannerUrl,
  isPrivate,
  onChange,
}: {
  avatarUrl: string;
  bannerUrl: string;
  isPrivate: boolean;
  onChange: (field: string, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Avatar URL <span className="text-[var(--color-muted)]">(optional)</span>
        </label>
        <input
          type="text"
          value={avatarUrl}
          onChange={(e) => onChange('avatarUrl', e.target.value)}
          placeholder="https://i.imgur.com/your-avatar.png"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
          Banner URL <span className="text-[var(--color-muted)]">(optional)</span>
        </label>
        <input
          type="text"
          value={bannerUrl}
          onChange={(e) => onChange('bannerUrl', e.target.value)}
          placeholder="https://i.imgur.com/your-banner.png"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
        />
      </div>

      {/* Privacy */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <input
          type="checkbox"
          id="is-private-wizard"
          checked={isPrivate}
          onChange={(e) => onChange('isPrivate', e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-card)] text-degen-500 focus:ring-degen-500/30"
        />
        <div>
          <label htmlFor="is-private-wizard" className="text-sm font-medium text-[var(--color-fg)]">
            Private Community
          </label>
          <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
            Only approved members can join and see posts. Federation is still active.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Review ────────────────────────────────────────────────────

function StepReview({
  name,
  displayName,
  description,
  category,
  tags,
  rulesText,
  avatarUrl,
  bannerUrl,
  isPrivate,
  linkedCoin,
}: {
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string;
  rulesText: string;
  avatarUrl: string;
  bannerUrl: string;
  isPrivate: boolean;
  linkedCoin: string;
}) {
  const rulesList = rulesText.split('\n').filter((r) => r.trim());
  const tagsList = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const catEmoji = CATEGORY_EMOJIS[category as FeddyCategory] || '🌐';
  const catLabel = CATEGORY_LABELS[category as FeddyCategory] || category;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
        <p className="text-xs text-degen-400">
          Almost done! Review your community details before creating.
        </p>
      </div>

      {/* Preview card */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
        {/* Banner preview */}
        <div
          className="h-24 bg-gradient-to-r from-degen-500/10 via-purple-500/10 to-degen-500/5 sm:h-32"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        />

        <div className="px-4 pb-4 sm:px-5">
          {/* Avatar */}
          <div className="relative -mt-8 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--bg)] bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-xl font-bold text-degen-400 shadow-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (displayName || name).charAt(0).toUpperCase()
            )}
          </div>

          <h3 className="text-lg font-bold text-[var(--color-fg)]">{displayName || name}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-medium text-purple-400">
              {catEmoji} {catLabel}
            </span>
            <span className="text-[9px] text-[var(--color-muted)]">
              {isPrivate ? '🔒 Private' : '🌐 Public'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
            {description || 'No description'}
          </p>

          {/* Handle */}
          <div className="mt-3 rounded-lg bg-[var(--color-overlay)] px-3 py-2">
            <p className="font-mono text-xs text-degen-400">
              @{name}@communities.degenfeed.xyz
            </p>
          </div>

          {/* Tags */}
          {tagsList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagsList.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] text-[var(--color-muted)]">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Rules */}
          {rulesList.length > 0 && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <p className="mb-1.5 text-[10px] font-bold text-[var(--color-fg)] uppercase tracking-wider">
                Rules
              </p>
              <ol className="space-y-1">
                {rulesList.map((rule, i) => (
                  <li key={i} className="flex gap-1.5 text-[10px] text-[var(--color-muted)]">
                    <span className="text-degen-400">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Linked coin */}
          {linkedCoin && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <p className="text-[10px] text-amber-400">🪙 Linked Coin: {linkedCoin}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ───────────────────────────────────────────────────────

export function CreateCommunityWizard({
  onCreated,
}: {
  onCreated: (name: string) => void;
}) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameChecking, setNameChecking] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FeddyCategory>('general');
  const [tags, setTags] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [linkedCoin, setLinkedCoin] = useState('');

  // Handle field changes
  const handleFieldChange = useCallback((field: string, value: string | boolean) => {
    switch (field) {
      case 'displayName': setDisplayName(value as string); break;
      case 'description': setDescription(value as string); break;
      case 'category': setCategory(value as FeddyCategory); break;
      case 'tags': setTags(value as string); break;
      case 'linkedCoin': setLinkedCoin(value as string); break;
      case 'avatarUrl': setAvatarUrl(value as string); break;
      case 'bannerUrl': setBannerUrl(value as string); break;
      case 'isPrivate': setIsPrivate(value as boolean); break;
    }
  }, []);

  // Validate name with debounce
  const handleNameChange = useCallback(async (newName: string) => {
    setName(newName);

    const validationError = validateName(newName);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    if (newName.length >= 3) {
      setNameChecking(true);
      try {
        const res = await fetch(`/api/feddy/reserve/${encodeURIComponent(newName)}`);
        if (res.status === 409) {
          setNameError('This name is already taken');
        } else {
          setNameError(null);
        }
      } catch {
        setNameError('Could not check availability');
      } finally {
        setNameChecking(false);
      }
    } else {
      setNameError(null);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep === 0 && nameError) return;
    if (currentStep === 0 && !name) {
      setNameError('Community name is required');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [currentStep, nameError, name]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/feddy/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          displayName: displayName || name,
          description,
          rules: rulesText.split('\n').filter((r) => r.trim()),
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          avatar: avatarUrl || undefined,
          banner: bannerUrl || undefined,
          isPrivate,
          linkedCoin: linkedCoin || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || `Failed to create (${res.status})`);
      }

      const community = await res.json() as { name: string };
      onCreated(community.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create community');
    } finally {
      setCreating(false);
    }
  }, [name, displayName, description, rulesText, category, tags, avatarUrl, bannerUrl, isPrivate, linkedCoin, onCreated]);

  const step = STEPS[currentStep];

  return (
    <div>
      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <button
                type="button"
                onClick={() => i < currentStep ? setCurrentStep(i) : undefined}
                className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
                  i === currentStep
                    ? 'text-degen-400'
                    : i < currentStep
                      ? 'text-degen-400/60 cursor-pointer'
                      : 'text-[var(--color-muted)]'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    i === currentStep
                      ? 'bg-degen-500/15 text-degen-400'
                      : i < currentStep
                        ? 'bg-degen-500/20 text-degen-400'
                        : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                  }`}
                >
                  {i < currentStep ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{STEP_ICONS[s]} {s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-px w-8 sm:w-12 ${
                    i < currentStep ? 'bg-degen-500/40' : 'bg-[var(--color-border)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="mb-8">
        {step === 'Name' && (
          <StepName
            name={name}
            onChange={handleNameChange}
            error={nameError}
            checking={nameChecking}
          />
        )}
        {step === 'Details' && (
          <StepDetails
            displayName={displayName}
            description={description}
            category={category}
            tags={tags}
            linkedCoin={linkedCoin}
            onChange={handleFieldChange}
          />
        )}
        {step === 'Rules' && (
          <StepRules
            rulesText={rulesText}
            onChange={setRulesText}
          />
        )}
        {step === 'Appearance' && (
          <StepAppearance
            avatarUrl={avatarUrl}
            bannerUrl={bannerUrl}
            isPrivate={isPrivate}
            onChange={handleFieldChange}
          />
        )}
        {step === 'Review' && (
          <StepReview
            name={name}
            displayName={displayName}
            description={description}
            category={category}
            tags={tags}
            rulesText={rulesText}
            avatarUrl={avatarUrl}
            bannerUrl={bannerUrl}
            isPrivate={isPrivate}
            linkedCoin={linkedCoin}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 disabled:opacity-40"
        >
          Back
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={currentStep === 0 && (!!nameError || !name)}
            className="rounded-xl bg-degen-500 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="rounded-xl bg-degen-500 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)] disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Community'}
          </button>
        )}
      </div>
    </div>
  );
}

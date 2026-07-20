'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

// == Types =================================================================

type CommunityType = 'lemmy' | 'peertube' | 'mastodon';

interface FormData {
  domain: string;
  communityType: CommunityType | '';
  communityName: string;
  description: string;
  adminEmail: string;
}

interface FormErrors {
  domain?: string;
  communityType?: string;
  communityName?: string;
  description?: string;
  adminEmail?: string;
}

interface SubmitState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  message?: string;
  deployId?: string;
  adminEmail?: string;
  guideUrl?: string;
  composeUrl?: string;
  communityType?: string;
}

// == Constants =============================================================

const COMMUNITY_TYPES: { value: CommunityType; label: string; icon: string }[] = [
  { value: 'lemmy', label: 'Community (Lemmy)', icon: '💬' },
  { value: 'peertube', label: 'Video (PeerTube)', icon: '🎬' },
  { value: 'mastodon', label: 'Social (Mastodon)', icon: '🐘' },
];

// == Validation ============================================================

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.domain.trim()) {
    errors.domain = 'Domain is required';
  } else if (
    !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
      form.domain.trim(),
    )
  ) {
    errors.domain = 'Enter a valid domain (e.g., community.example.com)';
  }

  if (!form.communityType) {
    errors.communityType = 'Select a community type';
  }

  if (!form.communityName.trim()) {
    errors.communityName = 'Community name is required';
  } else if (form.communityName.trim().length > 100) {
    errors.communityName = 'Must be 100 characters or fewer';
  }

  if (!form.description.trim()) {
    errors.description = 'Description is required';
  } else if (form.description.trim().length > 2000) {
    errors.description = 'Must be 2000 characters or fewer';
  }

  if (!form.adminEmail.trim()) {
    errors.adminEmail = 'Admin email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
    errors.adminEmail = 'Enter a valid email address';
  }

  return errors;
}

// == Form Input Component ==================================================

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// == Success View ==========================================================

function SuccessView({ state }: { state: SubmitState }) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-6 inline-flex items-center justify-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-degen-500/15 text-4xl shadow-[0_0_40px_rgba(34,197,94,0.15)]">
          ✅
        </span>
      </div>
      <h1 className="mb-3 text-2xl font-bold text-[var(--color-fg)]">Deploy Request Submitted</h1>
      <div className="mb-8 rounded-xl border border-degen-500/20 bg-degen-500/10 p-6">
        <p className="text-base text-[var(--color-fg)]">{state.message}</p>
        {state.deployId && (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Request ID:{' '}
            <code className="rounded bg-[var(--color-overlay)] px-1.5 py-0.5 font-mono text-degen-400">
              {state.deployId}
            </code>
          </p>
        )}
      </div>

      <div className="space-y-4 text-left">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 backdrop-blur-xl">
          <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">Next Steps</h3>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              Check your inbox at{' '}
              <strong className="text-[var(--color-fg)]">{state.adminEmail}</strong> for setup
              instructions
            </li>
            <li>Prepare a Linux server with Docker installed</li>
            <li>Point your domain DNS to your server IP</li>
            <li>Run the docker-compose.yml we generated for you</li>
            <li>Your instance will be federated with DegenFeed automatically</li>
          </ol>
        </div>

        {state.guideUrl && (
          <a
            href={state.guideUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-degen-500/15 px-5 py-3 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/25"
          >
            📖 Read the Deployment Guide
          </a>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/deploy"
          className="text-sm text-[var(--color-muted)] underline transition-colors hover:text-[var(--color-fg)]"
        >
          ← Back to Deploy
        </Link>
      </div>
    </div>
  );
}

// == Main Form =============================================================

export default function DeployRequestPage() {
  const searchParams = useSearchParams();
  const defaultType = (searchParams.get('type') as CommunityType) || '';

  const [form, setForm] = useState<FormData>({
    domain: '',
    communityType: defaultType,
    communityName: '',
    description: '',
    adminEmail: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const handleChange = useCallback(
    (field: keyof FormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const validation = validate(form);
      setErrors(validation);

      if (Object.keys(validation).length > 0) return;

      setSubmitState({ status: 'submitting' });

      try {
        const res = await fetch('/api/deploy/request', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            domain: form.domain.trim(),
            communityType: form.communityType,
            communityName: form.communityName.trim(),
            description: form.description.trim(),
            adminEmail: form.adminEmail.trim(),
          }),
        });

        const data = (await res.json()) as {
          ok: boolean;
          id?: string;
          adminEmail?: string;
          message?: string;
          guideUrl?: string;
          composeUrl?: string;
          communityType?: string;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          setSubmitState({
            status: 'error',
            message: data.error || 'Failed to submit deploy request',
          });
          return;
        }

        setSubmitState({
          status: 'success',
          deployId: data.id,
          adminEmail: data.adminEmail,
          message: data.message || 'Check your email for setup instructions.',
          guideUrl: data.guideUrl,
          composeUrl: data.composeUrl,
          communityType: data.communityType,
        });
      } catch {
        setSubmitState({
          status: 'error',
          message: 'Network error. Please try again.',
        });
      }
    },
    [form],
  );

  // == Success state =======================================================

  if (submitState.status === 'success') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <SuccessView state={submitState} />
      </div>
    );
  }

  // == Form =================================================================

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/deploy"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          ← Back to Launch
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Deploy Your Community</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Fill in the details and we&apos;ll generate a deployment config for your instance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Domain */}
        <Field label="Your Domain" error={errors.domain}>
          <input
            type="text"
            placeholder="community.example.com"
            value={form.domain}
            onChange={(e) => handleChange('domain', e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/50 focus:outline-none focus:ring-2 focus:ring-degen-500/20"
          />
        </Field>

        {/* Community type */}
        <Field label="Community Type" error={errors.communityType}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {COMMUNITY_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => handleChange('communityType', ct.value)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  form.communityType === ct.value
                    ? 'border-degen-500/50 bg-degen-500/10 text-degen-400 shadow-[0_0_12px_rgba(34,197,94,0.1)]'
                    : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span className="text-lg">{ct.icon}</span>
                <span>{ct.label}</span>
              </button>
            ))}
          </div>
        </Field>

        {/* Community name */}
        <Field label="Community Name" error={errors.communityName}>
          <input
            type="text"
            placeholder="My Awesome Community"
            value={form.communityName}
            onChange={(e) => handleChange('communityName', e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/50 focus:outline-none focus:ring-2 focus:ring-degen-500/20"
          />
          <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
            {form.communityName.length}/100
          </p>
        </Field>

        {/* Description */}
        <Field label="Community Description" error={errors.description}>
          <textarea
            placeholder="What is your community about? What topics will people discuss?"
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/50 focus:outline-none focus:ring-2 focus:ring-degen-500/20"
          />
          <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
            {form.description.length}/2000
          </p>
        </Field>

        {/* Admin email */}
        <Field label="Admin Email" error={errors.adminEmail}>
          <input
            type="email"
            placeholder="admin@example.com"
            value={form.adminEmail}
            onChange={(e) => handleChange('adminEmail', e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/50 focus:outline-none focus:ring-2 focus:ring-degen-500/20"
          />
        </Field>

        {/* Submit */}
        {submitState.status === 'error' && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{submitState.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitState.status === 'submitting'}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-degen-500 px-5 py-3.5 text-sm font-bold text-black transition-all hover:bg-degen-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_4px_16px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_24px_rgba(34,197,94,0.4)]"
        >
          {submitState.status === 'submitting' ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              Submitting...
            </>
          ) : (
            'Submit Deploy Request'
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
        By submitting, you agree to our{' '}
        <a href="/terms" className="underline transition-colors hover:text-[var(--color-fg)]">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline transition-colors hover:text-[var(--color-fg)]">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

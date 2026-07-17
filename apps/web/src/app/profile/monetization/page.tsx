'use client';

import type { MonetizationPreferences, StoredIdentity } from '@degenfeed/storage';
import {
  getDefaultMonetizationPreferences,
  getMonetizationPreferences,
  getPrimaryIdentity,
  saveMonetizationPreferences,
} from '@degenfeed/storage';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface FormState {
  evmAddress: string;
  solanaAddress: string;
  lightningAddress: string;
  farcasterCustodyAddress: string;
  lensProfile: string;
  nostrPubkey: string;
  preferredMethod: string;
}

const METHOD_OPTIONS = [
  { value: '', label: 'Auto (recommended)' },
  { value: 'ethereum', label: 'Ethereum / EVM' },
  { value: 'solana', label: 'Solana' },
  { value: 'lightning_zap', label: 'Lightning Zap' },
  { value: 'farcaster_frame', label: 'Farcaster Frame' },
  { value: 'lens_collect', label: 'Lens Collect' },
];

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidEvmAddress(value: string): boolean {
  return value === '' || EVM_ADDRESS_RE.test(value);
}

function isValidSolanaAddress(value: string): boolean {
  return value === '' || SOLANA_ADDRESS_RE.test(value);
}

function isValidLightningAddress(value: string): boolean {
  if (value === '') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toFormState(prefs: MonetizationPreferences): FormState {
  return {
    evmAddress: prefs.evmAddress || '',
    solanaAddress: prefs.solanaAddress || '',
    lightningAddress: prefs.lightningAddress || '',
    farcasterCustodyAddress: prefs.farcasterCustodyAddress || '',
    lensProfile: prefs.lensProfile || '',
    nostrPubkey: prefs.nostrPubkey || '',
    preferredMethod: prefs.preferredMethod || '',
  };
}

export default function MonetizationPage() {
  const [identity, setIdentity] = useState<StoredIdentity | undefined>(undefined);
  const [form, setForm] = useState<FormState>(toFormState(getDefaultMonetizationPreferences('')));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    const load = async () => {
      const primary = await getPrimaryIdentity();
      setIdentity(primary);
      if (primary) {
        const prefs =
          (await getMonetizationPreferences(primary.id)) ||
          getDefaultMonetizationPreferences(primary.id);
        setForm(toFormState(prefs));
      }
    };
    load().catch(() => {});
  }, []);

  const validate = useCallback((next: FormState): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!isValidEvmAddress(next.evmAddress)) {
      nextErrors.evmAddress = 'Invalid EVM address';
    }
    if (!isValidSolanaAddress(next.solanaAddress)) {
      nextErrors.solanaAddress = 'Invalid Solana address';
    }
    if (!isValidLightningAddress(next.lightningAddress)) {
      nextErrors.lightningAddress = 'Invalid Lightning address';
    }
    if (!isValidEvmAddress(next.farcasterCustodyAddress)) {
      nextErrors.farcasterCustodyAddress = 'Invalid Farcaster custody address';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, []);

  const handleChange = useCallback(
    (field: keyof FormState, value: string) => {
      const next = { ...form, [field]: value };
      setForm(next);
      validate(next);
      setStatus('idle');
    },
    [form, validate],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!identity || !validate(form)) return;

      setStatus('saving');
      try {
        const payload: MonetizationPreferences = {
          identityId: identity.id,
          updatedAt: Date.now(),
          ...(form.evmAddress ? { evmAddress: form.evmAddress } : {}),
          ...(form.solanaAddress ? { solanaAddress: form.solanaAddress } : {}),
          ...(form.lightningAddress ? { lightningAddress: form.lightningAddress } : {}),
          ...(form.farcasterCustodyAddress
            ? { farcasterCustodyAddress: form.farcasterCustodyAddress }
            : {}),
          ...(form.lensProfile ? { lensProfile: form.lensProfile } : {}),
          ...(form.nostrPubkey ? { nostrPubkey: form.nostrPubkey } : {}),
          ...(form.preferredMethod ? { preferredMethod: form.preferredMethod } : {}),
        };

        const res = await fetch('/api/tip/settings', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Server rejected settings');

        await saveMonetizationPreferences(payload);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    },
    [form, identity, validate],
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/profile"
          className="rounded-lg bg-[var(--color-muted)] px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-[var(--color-fg)] transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Creator Monetization</h1>
      </div>

      <div className="card mb-6 border-degen-500/20 bg-degen-500/5 p-4">
        <p className="text-sm text-degen-400">
          Configure how people can tip you across Nostr, Lens, Farcaster, and direct crypto.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-gray-500">
            Direct Crypto
          </h2>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">
              EVM Address (Ethereum, Base, Optimism, Arbitrum, Polygon)
            </span>
            <input
              type="text"
              value={form.evmAddress}
              onChange={(e) => handleChange('evmAddress', e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            />
            {errors.evmAddress && <p className="mt-1 text-xs text-red-400">{errors.evmAddress}</p>}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Solana Address</span>
            <input
              type="text"
              value={form.solanaAddress}
              onChange={(e) => handleChange('solanaAddress', e.target.value)}
              placeholder="7x..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            />
            {errors.solanaAddress && (
              <p className="mt-1 text-xs text-red-400">{errors.solanaAddress}</p>
            )}
          </label>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-gray-500">
            Platform Tipping
          </h2>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Lightning Address / LNURL</span>
            <input
              type="text"
              value={form.lightningAddress}
              onChange={(e) => handleChange('lightningAddress', e.target.value)}
              placeholder="you@walletofsatoshi.com"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            />
            {errors.lightningAddress && (
              <p className="mt-1 text-xs text-red-400">{errors.lightningAddress}</p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Farcaster Custody Address</span>
            <input
              type="text"
              value={form.farcasterCustodyAddress}
              onChange={(e) => handleChange('farcasterCustodyAddress', e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            />
            {errors.farcasterCustodyAddress && (
              <p className="mt-1 text-xs text-red-400">{errors.farcasterCustodyAddress}</p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Lens Profile (id or handle)</span>
            <input
              type="text"
              value={form.lensProfile}
              onChange={(e) => handleChange('lensProfile', e.target.value)}
              placeholder="0x01 or @handle"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Nostr Pubkey (for zaps)</span>
            <input
              type="text"
              value={form.nostrPubkey}
              onChange={(e) => handleChange('nostrPubkey', e.target.value)}
              placeholder="npub1... or hex"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            />
          </label>
        </div>

        <div className="card space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Preferred Default Method</span>
            <select
              value={form.preferredMethod}
              onChange={(e) => handleChange('preferredMethod', e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === 'saving' || Object.keys(errors).length > 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving...' : 'Save Settings'}
          </button>
          {status === 'saved' && <span className="text-xs text-green-400">Saved locally ✓</span>}
          {status === 'error' && (
            <span className="text-xs text-red-400">Could not save. Try again.</span>
          )}
        </div>
      </form>
    </div>
  );
}

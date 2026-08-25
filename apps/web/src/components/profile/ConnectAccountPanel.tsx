'use client';

/**
 * ConnectAccountPanel — Bring Your Own Account linking.
 *
 * Shows every linkable platform with its connection status and a per-protocol
 * "Connect Account" button. Users verify an EXISTING account (npub/NIP-05,
 * Bluesky handle, Farcaster FID, Mastodon handle, or an external X/YouTube/
 * GitHub/Discord/Telegram handle) and it is added to their unified identity.
 *
 * Verified identities are persisted through the same IndexedDB path as
 * protocol sign-ins (@degenfeed/storage), then AuthProvider.refresh() updates
 * the rest of the app.
 */

import { buildIdentityRecord } from '@degenfeed/auth';
import {
  ALL_LINKABLE_PLATFORMS,
  isExternalPlatform,
  type PlatformLinkMeta,
  type VerifiedIdentity,
  verifyExternalIdentity,
  verifyIdentity,
} from '@degenfeed/identity';
import { saveIdentity } from '@degenfeed/storage';
import { useCallback, useMemo, useState } from 'react';
import { PROTOCOL_COLORS, PROTOCOL_LABELS } from '../../app/profile/constants';
import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';

interface ConnectFormValues {
  input: string;
  nip05?: string;
}

interface ConnectAccountPanelProps {
  onConnected?: (protocol: string) => void;
}

/** Which fields each platform's connect form needs */
const FORM_FIELDS: Record<
  string,
  Array<{ key: 'input' | 'nip05'; label: string; placeholder: string }>
> = {
  nostr: [
    { key: 'input', label: 'npub or NIP-05', placeholder: 'npub1... or you@example.com' },
    {
      key: 'nip05',
      label: 'NIP-05 (optional, verifies ownership)',
      placeholder: 'you@example.com',
    },
  ],
  bluesky: [{ key: 'input', label: 'Handle or DID', placeholder: 'alice.bsky.social' }],
  farcaster: [{ key: 'input', label: 'FID or username', placeholder: '12345 or vitalik' }],
  lens: [{ key: 'input', label: 'Lens handle', placeholder: 'stani.lens' }],
  mastodon: [{ key: 'input', label: 'Mastodon handle', placeholder: 'user@instance.social' }],
  twitter: [
    { key: 'input', label: 'X handle or URL', placeholder: '@alice or https://x.com/alice' },
  ],
  youtube: [
    {
      key: 'input',
      label: 'Channel handle or URL',
      placeholder: '@channel or https://youtube.com/@channel',
    },
  ],
  github: [
    {
      key: 'input',
      label: 'GitHub username or URL',
      placeholder: 'octocat or https://github.com/octocat',
    },
  ],
  discord: [{ key: 'input', label: 'Username or user id', placeholder: 'alice#1234' }],
  telegram: [
    {
      key: 'input',
      label: 'Telegram username or URL',
      placeholder: '@alice or https://t.me/alice',
    },
  ],
};

export function ConnectAccountPanel({ onConnected }: ConnectAccountPanelProps) {
  const { linkedIdentities, primaryIdentity, walletAddress, refresh } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, ConnectFormValues>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  const connectedProtocols = useMemo(() => {
    const set = new Set<string>();
    if (primaryIdentity) set.add(primaryIdentity.protocol);
    for (const identity of linkedIdentities) set.add(identity.protocol);
    return set;
  }, [primaryIdentity, linkedIdentities]);

  const isConnected = (protocol: string) => connectedProtocols.has(protocol);

  const handleConnect = useCallback(
    async (meta: PlatformLinkMeta) => {
      const form = values[meta.id];
      const input = form?.input?.trim() ?? '';
      if (!input) {
        setError((e) => ({ ...e, [meta.id]: 'Enter a handle or URL to connect.' }));
        return;
      }

      setBusy(meta.id);
      setError((e) => ({ ...e, [meta.id]: '' }));
      try {
        // 1. Verify the identity (external platforms client-side, protocols via API)
        let verified: VerifiedIdentity | null = null;
        const platformId = meta.id;
        const isExternal = isExternalPlatform(platformId);
        if (isExternal) {
          verified = verifyExternalIdentity(platformId, input);
        } else {
          try {
            const res = await fetch('/api/identity/verify', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                protocol: meta.id,
                input,
                nip05: form?.nip05?.trim() || undefined,
              }),
            });
            const data = (await res.json()) as {
              ok: boolean;
              identity?: VerifiedIdentity;
              error?: string;
            };
            if (res.ok && data.ok && data.identity) {
              verified = data.identity;
            } else {
              // Fall back to client-side verification (works without the API)
              verified = await verifyIdentity(meta.id, input, {
                nip05: form?.nip05?.trim(),
              });
              if (!verified && data.error) {
                setError((e) => ({ ...e, [meta.id]: data.error ?? 'Verification failed' }));
              }
            }
          } catch {
            verified = await verifyIdentity(meta.id, input, { nip05: form?.nip05?.trim() });
          }
        }

        if (!verified) {
          setError((e) => ({
            ...e,
            [meta.id]: `Could not verify "${input}" on ${meta.label}. Check the format and try again.`,
          }));
          return;
        }

        // 2. Persist the linked identity (IndexedDB, same path as sign-in)
        const record = await buildIdentityRecord({
          protocol: verified.protocol,
          publicId: verified.identifier,
          handle: verified.handle,
          displayName: verified.displayName ?? verified.handle,
          avatarUrl: verified.avatarUrl,
          secret: null,
          isPrimary: false,
          keys: verified.profileUrl ? { profileUrl: verified.profileUrl } : undefined,
          links: verified.profileUrl
            ? [{ label: meta.label, url: verified.profileUrl }]
            : undefined,
        });
        record.verified = verified.verification !== 'url-format';
        await saveIdentity(record);

        // 3. Refresh auth state so the rest of the app sees the new identity
        await refresh();
        setOpen(null);
        setValues((v) => ({ ...v, [meta.id]: { input: '' } }));
        showToast(
          'success',
          `✓ Connected ${meta.label}${verified.handle ? ` (${verified.handle})` : ''}`,
        );
        onConnected?.(meta.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setError((e) => ({ ...e, [meta.id]: message }));
      } finally {
        setBusy(null);
      }
    },
    [values, refresh, showToast, onConnected],
  );

  const handleUnlink = useCallback(
    async (protocol: string) => {
      const identity = [...linkedIdentities, primaryIdentity].find((i) => i?.protocol === protocol);
      if (!identity) return;
      try {
        const { deleteIdentity } = await import('@degenfeed/storage');
        await deleteIdentity(identity.id);
        await refresh();
        showToast('success', `Disconnected ${PROTOCOL_LABELS[protocol] ?? protocol}`);
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to disconnect');
      }
    },
    [linkedIdentities, primaryIdentity, refresh, showToast],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-muted)]">
        Connect accounts you already have — we verify the handle and add it to your unified
        identity. Connections show as badges on your profile.
      </p>

      {ALL_LINKABLE_PLATFORMS.map((meta) => {
        const connected = isConnected(meta.id);
        const isOpen = open === meta.id;
        const fields = FORM_FIELDS[meta.id] ?? [];
        const busyNow = busy === meta.id;

        return (
          <div
            key={meta.id}
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden"
          >
            {/* Row header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{
                    backgroundColor: `${meta.color}22`,
                    color: meta.color,
                  }}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                    {meta.label}
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-muted)]">{meta.hint}</p>
                </div>
              </div>
              {connected ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-degen-500/15 px-2.5 py-1 text-[10px] font-medium text-degen-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-degen-400" />
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleUnlink(meta.id)}
                    className="rounded-lg border border-red-500/20 px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : meta.id)}
                  className="shrink-0 rounded-lg bg-degen-500/15 px-3 py-1.5 text-[11px] font-semibold text-degen-400 transition-colors hover:bg-degen-500/25"
                >
                  {isOpen ? 'Cancel' : 'Connect Account'}
                </button>
              )}
            </div>

            {/* Inline connect form */}
            {isOpen && !connected && (
              <div className="border-t border-[var(--color-glass-border)] px-4 py-3">
                <div className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label
                        className="mb-1 block text-[11px] text-[var(--color-muted)]"
                        htmlFor={`connect-${meta.id}-${field.key}`}
                      >
                        {field.label}
                      </label>
                      <input
                        id={`connect-${meta.id}-${field.key}`}
                        type="text"
                        value={values[meta.id]?.[field.key] ?? ''}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [meta.id]: {
                              ...(v[meta.id] ?? { input: '' }),
                              [field.key]: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                  {error[meta.id] && (
                    <p className="text-[11px] text-red-400" role="alert">
                      {error[meta.id]}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleConnect(meta)}
                    disabled={busyNow}
                    className="w-full rounded-xl bg-degen-500/20 px-4 py-2 text-xs font-bold text-degen-400 transition-colors hover:bg-degen-500/30 disabled:opacity-50"
                  >
                    {busyNow ? 'Verifying…' : 'Verify & Connect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!walletAddress && (
        <p className="text-[11px] text-[var(--color-muted)]">
          Connecting accounts associates them with your wallet identity. Wallet sign-in is
          recommended.
        </p>
      )}
    </div>
  );
}

// Re-export protocol color helper so consumers can style badges consistently
export function platformColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? '#666';
}

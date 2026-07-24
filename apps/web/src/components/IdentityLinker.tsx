'use client';

/**
 * IdentityLinker — Cross-protocol identity linking UI.
 *
 * Shows the active wallet + 6 social protocols with link status.
 * Protocols are linked under the currently active wallet.
 * When switching wallets, the linked protocols update automatically.
 */

import type { ProtocolId } from '@degenfeed/utils';
import { PROTOCOL_ID_REGISTRY } from '@degenfeed/utils';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { WalletSwitcher } from './WalletSwitcher';

interface LinkedIdentity {
  protocol: ProtocolId;
  handle?: string;
  verified: boolean;
  manualLinking?: boolean;
}

interface LinkFormState {
  open: ProtocolId | null;
  values: Partial<Record<ProtocolId, Record<string, string>>>;
  submitting: boolean;
  manualToggle: Partial<Record<ProtocolId, boolean>>;
}

const LINK_FIELDS: Record<
  ProtocolId,
  Array<{ key: string; label: string; placeholder: string }>
> = {
  nostr: [
    { key: 'npub', label: 'Nostr npub', placeholder: 'npub1...' },
    { key: 'relays', label: 'Relays (comma-separated)', placeholder: 'wss://relay.damus.io' },
  ],
  farcaster: [
    { key: 'fid', label: 'Farcaster FID', placeholder: 'e.g. 12345' },
    { key: 'username', label: 'Username', placeholder: 'vitalik' },
    { key: 'custodyAddress', label: 'Custody Address', placeholder: '0x...' },
  ],
  lens: [
    { key: 'handle', label: 'Lens Handle', placeholder: 'stani.lens' },
    { key: 'profileId', label: 'Profile ID', placeholder: '0x...' },
  ],
  bluesky: [
    { key: 'did', label: 'Bluesky DID', placeholder: 'did:plc:...' },
    { key: 'handle', label: 'Handle', placeholder: 'alice.bsky.social' },
  ],
  mastodon: [
    { key: 'handle', label: 'Handle', placeholder: 'alice' },
    { key: 'instance', label: 'Instance', placeholder: 'social.degenfeed.xyz' },
  ],
  reddit: [{ key: 'username', label: 'Reddit Username', placeholder: 'u/alice' }],
  threads: [
    { key: 'username', label: 'Threads Username', placeholder: 'alice' },
    { key: 'did', label: 'Threads DID (optional)', placeholder: 'did:plc:...' },
  ],
  lemmy: [
    { key: 'username', label: 'Lemmy Username', placeholder: 'alice' },
    { key: 'instance', label: 'Instance', placeholder: 'lemmy.world' },
  ],
  rss: [{ key: 'url', label: 'RSS Feed URL', placeholder: 'https://blog.example.com/feed.xml' }],
  peertube: [
    { key: 'username', label: 'PeerTube Username', placeholder: 'alice' },
    { key: 'channelId', label: 'Channel ID (optional)', placeholder: '12345' },
    { key: 'instance', label: 'Instance', placeholder: 'video.degenfeed.xyz' },
  ],
  telegram: [
    { key: 'userId', label: 'Telegram User ID', placeholder: '123456789' },
    { key: 'username', label: 'Telegram Username (optional)', placeholder: '@alice' },
  ],
  atproto: [
    { key: 'did', label: 'AT Protocol DID', placeholder: 'did:plc:abc123' },
    { key: 'handle', label: 'Handle', placeholder: 'alice.bsky.social' },
    { key: 'pdsUrl', label: 'PDS URL', placeholder: 'https://bsky.social' },
  ],
  zora: [
    { key: 'coinAddress', label: 'Creator Coin Address', placeholder: '0x...' },
    { key: 'network', label: 'Network', placeholder: 'base' },
  ],
};

export function IdentityLinker() {
  const { walletAddress, walletAddresses, walletMeta } = useAuth();
  const [linked, setLinked] = useState<LinkedIdentity[]>([]);
  const [_loading, setLoading] = useState(true);
  const [form, setForm] = useState<LinkFormState>({
    open: null,
    values: {},
    submitting: false,
    manualToggle: {},
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeMeta = walletAddress ? walletMeta[walletAddress] : undefined;

  const fetchLinked = useCallback(async () => {
    if (!walletAddress) {
      setLinked([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/identity/profile?wallet=${encodeURIComponent(walletAddress)}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        data: Record<string, Record<string, unknown> | undefined> | null;
      };
      if (!data.data) {
        setLinked([]);
        return;
      }
      const ids: LinkedIdentity[] = [];
      const extractHandle = (d: Record<string, unknown>): string | undefined =>
        (d.handle as string) ||
        (d.username as string) ||
        (d.npub as string) ||
        (d.did as string) ||
        (d.url as string) ||
        undefined;

      for (const [protocol, _info] of Object.entries(PROTOCOL_ID_REGISTRY)) {
        const pdata = data.data[protocol] as Record<string, unknown> | undefined;
        if (!pdata) continue;
        const handle = extractHandle(pdata);
        if (!handle) continue;
        ids.push({
          protocol: protocol as ProtocolId,
          handle,
          verified: Boolean(pdata.verified),
          manualLinking: Boolean(pdata.manualLinking),
        });
      }
      setLinked(ids);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  const isLinked = (protocol: ProtocolId) => linked.some((l) => l.protocol === protocol);
  const getLinkedHandle = (protocol: ProtocolId) =>
    linked.find((l) => l.protocol === protocol)?.handle;

  const handleLink = useCallback(
    async (protocol: ProtocolId) => {
      const values = form.values[protocol];
      if (!values) return;

      setForm((f) => ({ ...f, submitting: true }));
      setMessage(null);

      try {
        const payload: Record<string, unknown> = { ...values };
        const isManual = form.manualToggle[protocol] ?? false;
        if (isManual) payload.manualLinking = true;
        // Parse numeric fields
        if (protocol === 'farcaster' && payload.fid) payload.fid = Number(payload.fid);
        // Split relays string into array
        if (protocol === 'nostr' && payload.relays) {
          payload.relays = String(payload.relays)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }

        const res = await fetch('/api/identity/link', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            protocol,
            identity: payload,
            walletAddress, // Link under the active wallet
          }),
        });

        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !data.success) {
          setMessage({ type: 'error', text: data.error || 'Failed to link identity' });
          return;
        }

        setMessage({
          type: 'success',
          text: `${PROTOCOL_ID_REGISTRY[protocol].displayName} linked!`,
        });
        setForm((f) => ({
          ...f,
          open: null,
          values: { ...f.values, [protocol]: {} },
          manualToggle: { ...f.manualToggle, [protocol]: false },
        }));
        await fetchLinked();
      } catch (err) {
        setMessage({ type: 'error', text: String(err) });
      } finally {
        setForm((f) => ({ ...f, submitting: false }));
      }
    },
    [form.values, form.manualToggle, fetchLinked, walletAddress],
  );

  const handleUnlink = useCallback(
    async (protocol: ProtocolId) => {
      setMessage(null);
      try {
        const res = await fetch(
          `/api/identity/link?protocol=${protocol}&wallet=${encodeURIComponent(walletAddress ?? '')}`,
          {
            method: 'DELETE',
            credentials: 'include',
          },
        );
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !data.success) {
          setMessage({ type: 'error', text: data.error || 'Failed to unlink' });
          return;
        }
        setMessage({
          type: 'success',
          text: `${PROTOCOL_ID_REGISTRY[protocol].displayName} unlinked.`,
        });
        await fetchLinked();
      } catch (err) {
        setMessage({ type: 'error', text: String(err) });
      }
    },
    [fetchLinked, walletAddress],
  );

  if (!walletAddress) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-sm text-[var(--color-muted)]">
        Connect your wallet to link social identities.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Wallet display with switcher */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-sm font-mono text-degen-400">
          {walletAddress.slice(2, 4).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-[var(--color-fg)]">Connected Wallet</div>
          <div className="mt-1">
            <WalletSwitcher />
          </div>
        </div>
        {/* Chain badge */}
        {activeMeta && (
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              activeMeta.chain === 'solana'
                ? 'bg-purple-500/15 text-purple-400'
                : 'bg-blue-500/15 text-blue-400'
            }`}
          >
            {activeMeta.chain === 'solana' ? 'SOL' : 'ETH'}
          </span>
        )}
      </div>

      {/* Wallet address display */}
      {walletAddresses && walletAddresses.length > 1 && (
        <div className="text-[11px] text-[var(--color-muted)] text-center">
          {walletAddresses.length} wallets connected ·{' '}
          <span className="text-degen-400">
            {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)} active
          </span>
        </div>
      )}

      {/* Protocol list */}
      <div className="space-y-2">
        {(
          Object.entries(PROTOCOL_ID_REGISTRY) as [
            ProtocolId,
            (typeof PROTOCOL_ID_REGISTRY)[ProtocolId],
          ][]
        ).map(([protocol, meta]) => {
          const linkedHandle = getLinkedHandle(protocol);
          const isLinkedProtocol = isLinked(protocol);
          const formOpen = form.open === protocol;

          return (
            <div
              key={protocol}
              className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden"
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${!formOpen ? 'hover:bg-white/[0.03]' : ''}`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                  style={{ backgroundColor: `${meta.color}22` }}
                >
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-fg)]">
                      {meta.displayName}
                    </span>
                    {isLinkedProtocol && (
                      <>
                        <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                          ✓ Linked
                        </span>
                        {linked.find((l: LinkedIdentity) => l.protocol === protocol)
                          ?.manualLinking && (
                          <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                            Manual
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {linkedHandle ? (
                    <div className="text-xs text-[var(--color-muted)] truncate">{linkedHandle}</div>
                  ) : (
                    <div className="text-xs text-[var(--color-muted)]">Not linked</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (linked) {
                      handleUnlink(protocol);
                    } else {
                      setForm((f) => ({
                        ...f,
                        open: f.open === protocol ? null : protocol,
                        values: { ...f.values, [protocol]: f.values[protocol] || {} },
                      }));
                    }
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    linked
                      ? 'border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'border border-degen-500/30 bg-degen-500/10 text-degen-400 hover:bg-degen-500/20'
                  }`}
                >
                  {linked ? 'Unlink' : 'Link'}
                </button>
              </div>

              {/* Link form */}
              {formOpen && !isLinkedProtocol && (
                <div className="border-t border-[var(--color-glass-border)] px-4 py-3 space-y-3">
                  {LINK_FIELDS[protocol].map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs text-[var(--color-muted)]">
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={form.values[protocol]?.[field.key] || ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            values: {
                              ...f.values,
                              [protocol]: { ...f.values[protocol], [field.key]: e.target.value },
                            },
                          }))
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
                      />
                    </div>
                  ))}
                  {/* Manual linking toggle */}
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.manualToggle[protocol] ?? false}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          manualToggle: { ...f.manualToggle, [protocol]: e.target.checked },
                        }))
                      }
                      className="rounded border-[var(--color-border)] bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                    />
                    <span className="text-xs text-[var(--color-muted)]">
                      Manual link (skip auto-verification — use when this identity can't be
                      auto-resolved)
                    </span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleLink(protocol)}
                      disabled={form.submitting}
                      className="btn-primary flex-1 text-xs"
                    >
                      {form.submitting ? 'Linking...' : `Link ${meta.displayName}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, open: null }))}
                      className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-2 text-xs font-medium ${
            message.type === 'success'
              ? 'bg-degen-500/15 text-degen-400 border border-degen-500/20'
              : 'bg-red-500/15 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

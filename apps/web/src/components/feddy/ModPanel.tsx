'use client';

import { useCallback, useState } from 'react';
import type { FeddyCommunity, MemberRole } from './types';

export function ModPanel({
  community,
  viewerRole,
  onUpdate,
}: {
  community: FeddyCommunity;
  viewerRole: MemberRole | null;
  onUpdate: () => void;
}) {
  const isOwner = viewerRole === 'owner';
  const canEdit = viewerRole === 'owner' || viewerRole === 'moderator';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState(community.displayName);
  const [description, setDescription] = useState(community.description);
  const [rules, setRules] = useState(community.rules.join('\n'));
  const [avatarUrl, setAvatarUrl] = useState(community.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl);
  const [isPrivate, setIsPrivate] = useState(community.isPrivate);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/feddy/${encodeURIComponent(community.name)}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: displayName.trim(),
          description: description.trim(),
          rules: rules.split('\n').filter((r) => r.trim().length > 0),
          avatar: avatarUrl.trim(),
          banner: bannerUrl.trim(),
          isPrivate,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Failed to save');
      }

      setSuccess('Settings saved successfully!');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [community.name, displayName, description, rules, avatarUrl, bannerUrl, isPrivate, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!isOwner) return;
    if (
      !window.confirm(
        'Are you sure you want to delete this community? This action cannot be undone.',
      )
    )
      return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/feddy/${encodeURIComponent(community.name)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Failed to delete');
      }

      window.location.href = '/feddy';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete community');
    } finally {
      setSaving(false);
    }
  }, [community.name, isOwner]);

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <span className="mb-2 text-3xl">🔒</span>
        <p className="text-sm text-[var(--color-muted)]">
          Only owners and moderators can access the mod panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Mod Tools</h3>
        {isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            Delete Community
          </button>
        )}
      </div>

      {/* Settings form */}
      <div className="space-y-4">
        <div>
          <label
            className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
            htmlFor="field-306750ce"
          >
            Display Name
          </label>
          <input
            id="field-306750ce"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
            htmlFor="field-3d656e5f"
          >
            Description
          </label>
          <textarea
            id="field-3d656e5f"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
            htmlFor="field-bb252df5"
          >
            Rules (one per line)
          </label>
          <textarea
            id="field-bb252df5"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="No spam&#10;Be respectful&#10;Stay on topic"
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              htmlFor="field-77c8543c"
            >
              Avatar URL
            </label>
            <input
              id="field-77c8543c"
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              htmlFor="field-41eb7234"
            >
              Banner URL
            </label>
            <input
              id="field-41eb7234"
              type="text"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-private"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-card)] text-degen-500 focus:ring-degen-500/30"
          />
          <label htmlFor="is-private" className="text-sm text-[var(--color-fg)]">
            Private community (invite only)
          </label>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 p-3">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-500/10 p-3">
            <p className="text-xs text-green-400">{success}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-degen-500 px-6 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * EditProfileModal — Modal for editing display name, bio, website, and avatar.
 * Uses the existing auth provider to persist changes to the primary identity.
 */

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

export interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const { primaryIdentity } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(primaryIdentity?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from primary identity when it loads
  const initializedRef = useRef(false);
  if (primaryIdentity && !initializedRef.current) {
    initializedRef.current = true;
    setDisplayName(primaryIdentity.displayName ?? '');
    setBio('');
    setWebsite('');
  }

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Build FormData
      const form = new FormData();
      form.append('displayName', displayName.trim() || primaryIdentity?.displayName || '');
      form.append('bio', bio.trim());
      form.append('website', website.trim());
      if (avatarFile) form.append('avatar', avatarFile);

      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Save failed (${res.status})`);
      }

      showToast('success', 'Profile updated');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  }, [displayName, bio, website, avatarFile, primaryIdentity, onClose, showToast]);

  // Reset when opening
  const handleClose = useCallback(() => {
    initializedRef.current = false;
    setAvatarPreview(null);
    setAvatarFile(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-modal-content-in overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-6 py-4">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Edit Profile</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-glass-border)]">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Avatar preview"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : primaryIdentity?.avatarUrl ? (
                <Image
                  src={primaryIdentity.avatarUrl}
                  alt={primaryIdentity.displayName || 'Avatar'}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-lg font-bold text-[var(--color-fg)]">
                  {primaryIdentity?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs"
              >
                Change photo
              </button>
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">PNG, JPG, WEBP · Max 2MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="sr-only"
            />
          </div>

          {/* Display Name */}
          <div>
            <label
              htmlFor="edit-display-name"
              className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
            >
              Display Name
            </label>
            <input
              id="edit-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="input"
              placeholder="Your display name"
            />
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="edit-bio"
              className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
            >
              Bio
            </label>
            <textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              className="input resize-none"
              placeholder="Tell us about yourself"
            />
            <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
              {bio.length}/160
            </p>
          </div>

          {/* Website */}
          <div>
            <label
              htmlFor="edit-website"
              className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
            >
              Website
            </label>
            <input
              id="edit-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input"
              placeholder="https://example.com"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-glass-border)] px-6 py-4">
          <button type="button" onClick={handleClose} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm min-w-[100px]"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

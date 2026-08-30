'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '../../../../components/AuthProvider';
import { useAnnouncer } from '../../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../../lib/retryFetch';
import { shortAddr } from '../helpers';
import type { GroupSummary } from '../types';

export function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: GroupSummary) => void;
}) {
  const { tokens } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { announce } = useAnnouncer();

  const addMember = useCallback(() => {
    const addr = memberInput.trim().toLowerCase();
    if (!addr || members.includes(addr)) return;
    if (addr === tokens.evmAddress?.toLowerCase()) return;
    setMembers((prev) => [...prev, addr]);
    setMemberInput('');
  }, [memberInput, members, tokens.evmAddress]);

  const removeMember = useCallback(
    (addr: string) => setMembers((prev) => prev.filter((m) => m !== addr)),
    [],
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    if (members.length < 1) {
      setError('Add at least one member');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const data = await retryFetchJson<{ ok: boolean; group: GroupSummary }>(
        '/api/messages/groups/create',
        {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim(),
              memberIds: members,
            }),
          },
        },
      );
      if (data.ok && data.group) {
        announce(`Group "${name}" created`, 'polite');
        onCreated(data.group);
        onClose();
        setName('');
        setDescription('');
        setMembers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }, [name, description, members, announce, onCreated, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <h2 id="create-group-title" className="text-lg font-bold text-[var(--color-fg)] mb-5">
          Create Group
        </h2>
        <div className="mb-4">
          <label
            htmlFor="group-name"
            className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
          >
            Group Name
          </label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crypto Traders"
            maxLength={100}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="group-desc"
            className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
          >
            Description
          </label>
          <textarea
            id="group-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            rows={2}
            maxLength={500}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow resize-none"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="member-input"
            className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
          >
            Add Members ({members.length})
          </label>
          <div className="flex gap-2">
            <input
              id="member-input"
              type="text"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMember();
                }
              }}
              placeholder="Wallet address or handle..."
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
            />
            <button
              type="button"
              onClick={addMember}
              disabled={!memberInput.trim()}
              className="rounded-xl bg-degen-500/20 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 disabled:opacity-30 transition-colors"
            >
              Add
            </button>
          </div>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {members.map((addr) => (
                <span
                  key={addr}
                  className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2.5 py-1 text-[10px] text-degen-400"
                >
                  {shortAddr(addr)}
                  <button
                    type="button"
                    onClick={() => removeMember(addr)}
                    className="hover:text-red-400 transition-colors"
                    aria-label={`Remove ${shortAddr(addr)}`}
                  >
                    <svg
                      aria-hidden="true"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {error && (
          <p className="mb-4 text-xs text-red-400 flex items-center gap-1.5" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim() || members.length === 0}
            className="flex-1 rounded-xl bg-degen-500 py-2.5 text-sm font-bold text-black hover:bg-degen-400 disabled:opacity-30 transition-all disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

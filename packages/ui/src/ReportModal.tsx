'use client';

import { useCallback, useState } from 'react';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'scam', label: 'Scam' },
  { value: 'nsfw', label: 'NSFW' },
  { value: 'other', label: 'Other' },
] as const;

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  onSubmitted: () => void;
}

export function ReportModal({ open, onClose, postId, onSubmitted }: ReportModalProps) {
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!reason) {
      setError('Please select a reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, reason, description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Failed to submit report');
      }
      onSubmitted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [reason, description, postId, onSubmitted, onClose]);

  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      aria-modal="true"
      aria-label="Report post"
      role="dialog"
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Report post</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Close"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" role="img" aria-label="Close icon">
              <title>Close</title>
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          Help us keep DegenFeed safe. Your report is anonymous.
        </p>

        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium text-white">Reason</legend>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-800 px-4 py-3 transition-colors hover:border-gray-700 has-[:checked]:border-degen-500/50 has-[:checked]:bg-degen-500/5"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-4 w-4 accent-degen-500"
                />
                <span className="text-sm text-gray-300">{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mb-4">
          <label htmlFor="report-desc" className="mb-1 block text-sm font-medium text-gray-400">
            Additional details <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            id="report-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide any additional context…"
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-degen-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !reason}
          className="w-full rounded-xl bg-degen-500 px-4 py-3 text-sm font-semibold text-black hover:bg-degen-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </section>
  );
}

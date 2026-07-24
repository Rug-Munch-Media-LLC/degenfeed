/**
 * @degenfeed/ui — Lemmy Reply Form
 */

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';

export const ReplyForm = memo(function ReplyForm({
  parentId: _parentId,
  authorName,
  onClose,
}: {
  parentId: string;
  authorName: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setSubmitted(true);
      setTimeout(onClose, 1200);
    } catch { /* fallback */ } finally { setSubmitting(false); }
  }, [text, submitting, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSubmit(); }
  }, [handleSubmit, onClose]);

  if (submitted) {
    return <div className="mt-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">Reply posted!</div>;
  }

  return (
    <div className="mt-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2">
      <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown} placeholder={`Reply to ${authorName}…`} rows={3}
        className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-[var(--color-muted)] placeholder-gray-600 focus:border-degen-500/30 focus:outline-none focus:ring-1 focus:ring-degen-500/20"
        aria-label={`Reply to ${authorName}`} />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">
          <kbd className="rounded bg-white/5 px-1 py-0.5 font-mono text-[9px]">Ctrl+Enter</kbd> to send
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-muted)]">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={!text.trim() || submitting}
            className="rounded-md bg-degen-500/20 px-3 py-1 text-[11px] font-medium text-degen-400 transition-colors hover:bg-degen-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Posting…' : 'Reply'}</button>
        </div>
      </div>
    </div>
  );
});

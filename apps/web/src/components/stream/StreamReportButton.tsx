'use client';

import { useCallback, useState } from 'react';

interface StreamReportButtonProps {
  streamId: string;
}

const REPORT_REASONS = [
  'Inappropriate content',
  'Harassment / Hate speech',
  'Copyright violation',
  'Scam / Fraud',
  'Spam / Misleading',
  'Other',
];

export function StreamReportButton({ streamId }: StreamReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setReason('');
    }, 2000);
  }, [reason]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-[0.97]"
        aria-label="Report"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Report
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl animate-slide-up z-50">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-xs font-medium text-white/80">Report submitted</p>
              <p className="text-[10px] text-white/40 text-center">Thank you. Our moderation team will review this stream.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-3">
              <h4 className="text-xs font-semibold text-white/90 mb-2">Report stream</h4>
              <div className="space-y-1">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                      reason === r ? 'bg-degen-500/10 text-degen-400' : 'text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="sr-only"
                    />
                    {r}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-white/50 hover:bg-white/5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reason}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-30 hover:bg-red-500"
                >
                  Submit report
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

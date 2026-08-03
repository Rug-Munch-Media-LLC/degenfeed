'use client';

import { useCallback, useState } from 'react';
import { STREAM_CATEGORIES, type StreamCategory } from './types';

/* === Go Live Setup Form ======================================= */

interface GoLiveSetupData {
  title: string;
  category: StreamCategory;
  description: string;
  tags: string[];
  thumbnail?: File;
  latency: 'low' | 'normal';
}

interface GoLiveSetupProps {
  onStart: (data: GoLiveSetupData) => void;
  onCancel: () => void;
  initialData?: Partial<GoLiveSetupData>;
}

export function GoLiveSetup({onStart, initialData}: GoLiveSetupProps) {
  const [form, setForm] = useState<GoLiveSetupData>({
    title: initialData?.title ?? '',
    category: initialData?.category ?? 'crypto',
    description: initialData?.description ?? '',
    tags: initialData?.tags ?? ['live', 'degen'],
    latency: initialData?.latency ?? 'normal',
  });
  const [tagInput, setTagInput] = useState('');
  const [step, setStep] = useState(1);
  const [isStarting, setIsStarting] = useState(false);

  const addTag = useCallback(() => {
    const tag = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (tag && !form.tags.includes(tag) && form.tags.length < 5) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
    }
    setTagInput('');
  }, [tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }, []);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    onStart(form);
    setIsStarting(false);
  }, [form, onStart]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Stream key header */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white/90">Stream Key</h3>
            <p className="text-[10px] text-white/40">
              Use this key in OBS or your streaming software
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-white/50 hover:bg-white/5"
            onClick={() => navigator.clipboard.writeText('df-stream-key-xxxx-xxxx-xxxx')}
          >
            Copy
          </button>
        </div>
        <div className="mt-2 rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-degen-400">
          df-stream-key-xxxx-xxxx-xxxx
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              step === s
                ? 'bg-degen-500 text-black'
                : step > s
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'border border-white/10 text-white/30'
            }`}
          >
            {step > s ? '✓' : s}
          </button>
        ))}
        <span className="text-[10px] text-white/30">Step {step} of 3</span>
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label htmlFor="setup-title" className="mb-1.5 block text-sm font-medium text-white/80">
              Stream Title
            </label>
            <input
              id="setup-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What's your stream about?"
              maxLength={120}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-degen-500/40 focus:shadow-[0_0_8px_rgba(0,255,65,0.15)]"
            />
            <p className="mt-1 text-right text-[10px] text-white/30">{form.title.length}/120</p>
          </div>

          <div>
            <label
              htmlFor="setup-category"
              className="mb-1.5 block text-sm font-medium text-white/80"
            >
              Category
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {STREAM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat.id }))}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                    form.category === cat.id
                      ? 'border-degen-500/50 bg-degen-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span
                    className={`text-[10px] font-medium ${form.category === cat.id ? 'text-degen-400' : 'text-white/60'}`}
                  >
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg bg-degen-500 px-6 py-2 text-xs font-bold text-black hover:bg-degen-400"
            >
              Next — Stream Settings
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Description + Tags */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label htmlFor="setup-desc" className="mb-1.5 block text-sm font-medium text-white/80">
              Description <span className="text-white/30">(optional)</span>
            </label>
            <textarea
              id="setup-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Tell viewers what to expect..."
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-degen-500/40 resize-none"
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-white/80"
              htmlFor="field-7802d9f3"
            >
              Tags <span className="text-white/30">(up to 5)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="field-7802d9f3"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a tag..."
                maxLength={20}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-degen-500/40"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!tagInput.trim() || form.tags.length >= 5}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:bg-white/5 disabled:opacity-30"
              >
                Add
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2.5 py-1 text-[10px] font-medium text-degen-400"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 text-degen-400/60 hover:text-degen-400"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-white/10 px-6 py-2 text-xs text-white/50 hover:bg-white/5"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-degen-500 px-6 py-2 text-xs font-bold text-black hover:bg-degen-400"
            >
              Next — Review & Go Live
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          {/* Preview card */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="aspect-video bg-gradient-to-br from-degen-500/20 to-purple-600/20 flex items-center justify-center">
              <div className="text-center">
                <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Preview
                </span>
                <p className="mt-2 text-xs text-white/30">Stream preview will appear here</p>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-white">{form.title || 'Untitled Stream'}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                <span>{STREAM_CATEGORIES.find((c) => c.id === form.category)?.label}</span>
                {form.tags.map((t) => (
                  <span key={t} className="text-white/30">
                    #{t}
                  </span>
                ))}
              </div>
              {form.description && (
                <p className="mt-1 text-xs text-white/40 line-clamp-2">{form.description}</p>
              )}
            </div>
          </div>

          {/* Latency */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-white/80">Stream Latency</span>
            <div className="flex gap-2">
              {[
                {
                  value: 'low' as const,
                  label: 'Low Latency',
                  desc: 'Near real-time, slight quality reduction',
                },
                {
                  value: 'normal' as const,
                  label: 'Normal',
                  desc: 'Standard latency, best quality',
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, latency: opt.value }))}
                  className={`flex-1 rounded-xl border p-3 text-left transition-all ${
                    form.latency === opt.value
                      ? 'border-degen-500/50 bg-degen-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold ${form.latency === opt.value ? 'text-degen-400' : 'text-white/70'}`}
                  >
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-[9px] text-white/40">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-white/50 hover:bg-white/5"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={!form.title.trim() || isStarting}
              className="flex-1 rounded-lg bg-gradient-to-r from-degen-500 to-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-400 hover:to-emerald-400 disabled:opacity-30"
            >
              {isStarting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Starting...
                </span>
              ) : (
                'Go Live'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

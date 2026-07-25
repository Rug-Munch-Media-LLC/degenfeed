'use client';

import type { FontSize, Theme } from '../../hooks/usePreferences';
import { SelectRow } from './SelectRow';
import type { Preferences } from './types';

interface AppearanceSectionProps {
  prefs: Preferences;
  setTheme: (t: Theme) => void;
  setFontSize: (f: FontSize) => void;
  setLayoutDensity: (d: 'compact' | 'comfortable' | 'visual') => void;
}

export function AppearanceSection({ prefs, setTheme, setFontSize, setLayoutDensity }: AppearanceSectionProps) {
  return (
    <div>
      <SelectRow id="settings-theme" label="Theme" value={prefs.theme}
        options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'auto', label: 'System' }]}
        onChange={(v) => setTheme(v as Theme)} />
      <SelectRow id="settings-font-size" label="Font Size" value={prefs.fontSize}
        options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
        onChange={(v) => setFontSize(v as FontSize)} />
      <div className="space-y-2">
        <span className="text-sm text-[var(--color-fg)]">Layout Density</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'compact', label: 'Compact', icon: '▬', desc: 'Tighter spacing' },
            { value: 'comfortable', label: 'Comfortable', icon: '▭', desc: 'Balanced' },
            { value: 'visual', label: 'Visual', icon: '◻', desc: 'More media' },
          ].map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => setLayoutDensity(opt.value as 'compact' | 'comfortable' | 'visual')}
              className={`rounded-xl border-2 p-3 text-center transition-all ${prefs.layoutDensity === opt.value ? 'border-degen-500 bg-degen-500/10' : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)] hover:border-degen-500/30'}`}
              aria-pressed={prefs.layoutDensity === opt.value}>
              <div className="text-lg mb-1">{opt.icon}</div>
              <div className="text-xs font-medium text-[var(--color-fg)]">{opt.label}</div>
              <div className="text-[10px] text-[var(--color-muted)]">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * @degenfeed/web — shared theme class management
 *
 * Single source of truth for applying the resolved theme to <html>.
 * The design token system (styles/design-tokens.css) defines dark colors on
 * the `:root` default and light colors under the `.light` class, so the
 * applied theme must be expressed as exactly ONE of `dark`/`light` classes
 * plus the `data-theme` attribute (used by the <head> bootstrap script and
 * any data-theme consumers).
 *
 * The root layout injects an inline <head> script (THEME_BOOTSTRAP_SCRIPT)
 * that performs the same resolution BEFORE first paint; this module is the
 * post-hydration equivalent so toggles never diverge from the pre-paint
 * state (e.g. ending up with both .dark and .light classes present).
 */

export type ThemeMode = 'dark' | 'light' | 'auto';

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'light') return mode;
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function applyThemeClass(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved = resolveTheme(mode);
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
  root.setAttribute('data-theme', resolved);
}

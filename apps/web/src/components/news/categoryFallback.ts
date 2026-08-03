/**
 * Branded category fallback for news cards without a hero image.
 *
 * When an article has no extractable image we render a CSS gradient with a
 * category glyph (emoji/symbol) instead of a generic placeholder. This is a
 * pure CSS approach — no image assets, no network requests — and gives the
 * feed a branded feel even for image-less articles (goal: every card looks
 * intentional).
 */

export interface CategoryFallbackStyle {
  glyph: string;
  /** Tailwind classes for the gradient tile */
  bg: string;
  /** Tailwind classes for the glyph text */
  text: string;
  /** Tailwind classes for the category badge chip */
  badge: string;
}

const CATEGORY_FALLBACKS: Record<string, CategoryFallbackStyle> = {
  crypto: {
    glyph: '₿',
    bg: 'bg-gradient-to-br from-orange-950/80 to-amber-900/40',
    text: 'text-amber-500/70',
    badge: 'bg-orange-500/15',
  },
  bitcoin: {
    glyph: '₿',
    bg: 'bg-gradient-to-br from-orange-950/80 to-amber-900/40',
    text: 'text-orange-400/80',
    badge: 'bg-orange-500/15',
  },
  ethereum: {
    glyph: 'Ξ',
    bg: 'bg-gradient-to-br from-indigo-950/80 to-blue-900/40',
    text: 'text-indigo-400/80',
    badge: 'bg-blue-500/15',
  },
  solana: {
    glyph: '◎',
    bg: 'bg-gradient-to-br from-emerald-950/80 to-green-900/40',
    text: 'text-emerald-400/80',
    badge: 'bg-green-500/15',
  },
  defi: {
    glyph: '💧',
    bg: 'bg-gradient-to-br from-cyan-950/80 to-teal-900/40',
    text: 'text-cyan-400/80',
    badge: 'bg-cyan-500/15',
  },
  nft: {
    glyph: '🖼️',
    bg: 'bg-gradient-to-br from-violet-950/80 to-purple-900/40',
    text: 'text-violet-400/80',
    badge: 'bg-violet-500/15',
  },
  regulation: {
    glyph: '⚖️',
    bg: 'bg-gradient-to-br from-yellow-950/80 to-amber-900/40',
    text: 'text-yellow-400/80',
    badge: 'bg-yellow-500/15',
  },
  security: {
    glyph: '🛡️',
    bg: 'bg-gradient-to-br from-red-950/80 to-rose-900/40',
    text: 'text-red-400/80',
    badge: 'bg-red-500/15',
  },
  markets: {
    glyph: '📈',
    bg: 'bg-gradient-to-br from-emerald-950/80 to-teal-900/40',
    text: 'text-emerald-400/80',
    badge: 'bg-emerald-500/15',
  },
  macro: {
    glyph: '📊',
    bg: 'bg-gradient-to-br from-amber-950/80 to-yellow-900/40',
    text: 'text-amber-400/80',
    badge: 'bg-amber-500/15',
  },
  tech: {
    glyph: '💻',
    bg: 'bg-gradient-to-br from-slate-800/90 to-slate-900/60',
    text: 'text-slate-400/80',
    badge: 'bg-slate-500/15',
  },
  ai: {
    glyph: '🤖',
    bg: 'bg-gradient-to-br from-fuchsia-950/80 to-purple-900/40',
    text: 'text-fuchsia-400/80',
    badge: 'bg-fuchsia-500/15',
  },
  science: {
    glyph: '🔬',
    bg: 'bg-gradient-to-br from-teal-950/80 to-cyan-900/40',
    text: 'text-teal-400/80',
    badge: 'bg-teal-500/15',
  },
  geopolitics: {
    glyph: '🌍',
    bg: 'bg-gradient-to-br from-blue-950/80 to-indigo-900/40',
    text: 'text-blue-400/80',
    badge: 'bg-blue-500/15',
  },
  world: {
    glyph: '🌐',
    bg: 'bg-gradient-to-br from-sky-950/80 to-blue-900/40',
    text: 'text-sky-400/80',
    badge: 'bg-sky-500/15',
  },
  business: {
    glyph: '💼',
    bg: 'bg-gradient-to-br from-stone-800/90 to-slate-900/60',
    text: 'text-stone-400/80',
    badge: 'bg-stone-500/15',
  },
  academic: {
    glyph: '🎓',
    bg: 'bg-gradient-to-br from-indigo-950/80 to-violet-900/40',
    text: 'text-indigo-400/80',
    badge: 'bg-indigo-500/15',
  },
  research: {
    glyph: '📚',
    bg: 'bg-gradient-to-br from-purple-950/80 to-fuchsia-900/40',
    text: 'text-purple-400/80',
    badge: 'bg-purple-500/15',
  },
  dev: {
    glyph: '👨‍💻',
    bg: 'bg-gradient-to-br from-gray-800/90 to-slate-900/60',
    text: 'text-gray-400/80',
    badge: 'bg-gray-500/15',
  },
  default: {
    glyph: '📰',
    bg: 'bg-gradient-to-br from-gray-800/90 to-slate-900/60',
    text: 'text-gray-500/80',
    badge: 'bg-gray-500/15',
  },
};

/**
 * Resolve the branded fallback style for a category. Normalizes kebab-case
 * and lowercase, falls back to a neutral default.
 */
export function categoryFallback(category: string | undefined): CategoryFallbackStyle {
  const fallback: CategoryFallbackStyle = CATEGORY_FALLBACKS.default as CategoryFallbackStyle;
  if (!category) return fallback;
  const key = category.toLowerCase().replace(/[^a-z0-9]/g, '');
  return CATEGORY_FALLBACKS[key] ?? fallback;
}

/** Category glyph used for the card tile fallback (emoji/symbol). */
export function categoryGlyph(category: string | undefined): string {
  return categoryFallback(category).glyph;
}

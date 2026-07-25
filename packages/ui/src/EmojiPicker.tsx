'use client';

/**
 * @degenfeed/ui — EmojiPicker
 *
 * Lightweight emoji picker, no external deps.
 * Categories: smileys, gestures, food, animals, travel, symbols.
 * Fits inside the ComposeModal or any textarea context.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: '😊',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😇',
      '🙂',
      '😉',
      '😌',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '🤨',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '😮',
      '😯',
      '😲',
      '😳',
      '🥺',
      '😢',
      '😭',
      '😤',
      '😡',
      '🤬',
      '😈',
      '👿',
      '💀',
      '☠',
      '💩',
    ],
  },
  {
    id: 'gestures',
    label: '👋',
    emojis: [
      '👋',
      '🤚',
      '🖐',
      '✋',
      '🖖',
      '👌',
      '🤌',
      '🤏',
      '✌',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '🖕',
      '👇',
      '👍',
      '👎',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
    ],
  },
  {
    id: 'food',
    label: '🍕',
    emojis: [
      '🍇',
      '🍈',
      '🍉',
      '🍊',
      '🍋',
      '🍌',
      '🍍',
      '🥭',
      '🍎',
      '🍏',
      '🍐',
      '🍑',
      '🍒',
      '🍓',
      '🫐',
      '🥝',
      '🍅',
      '🫒',
      '🥥',
      '🥑',
      '🍆',
      '🥔',
      '🥕',
      '🌽',
      '🌶',
      '🫑',
      '🥒',
      '🥬',
      '🥦',
      '🧄',
      '🧅',
      '🍄',
      '🥜',
      '🌰',
      '🍞',
      '🥐',
      '🥖',
      '🫓',
      '🥨',
      '🧀',
      '🍕',
      '🍔',
      '🍟',
      '🌭',
      '🥪',
      '🌮',
      '🌯',
      '🫔',
      '🥗',
      '🍿',
    ],
  },
  {
    id: 'animals',
    label: '🐶',
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐻‍❄️',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🙈',
      '🙉',
      '🙊',
      '🐒',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🐣',
      '🐥',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🪱',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
    ],
  },
  {
    id: 'travel',
    label: '🌍',
    emojis: [
      '🌍',
      '🌎',
      '🌏',
      '🌐',
      '🗺',
      '🗾',
      '🧭',
      '🏔',
      '⛰',
      '🌋',
      '🗻',
      '🏕',
      '🏖',
      '🏜',
      '🏝',
      '🏞',
      '🏟',
      '🏛',
      '🏗',
      '🧱',
      '🪨',
      '🪵',
      '🛖',
      '🏘',
      '🏚',
      '🏠',
      '🏡',
      '🏢',
      '🏣',
      '🏤',
    ],
  },
  {
    id: 'symbols',
    label: '💎',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❤️‍🔥',
      '❤️‍🩹',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '🔥',
      '💯',
      '💎',
      '💰',
      '🪙',
      '💳',
      '💸',
      '🔑',
      '🔒',
      '🔓',
      '🚀',
      '🌙',
      '⭐',
      '✨',
      '🌟',
      '💫',
      '⚡',
      '🔥',
      '💦',
      '🎯',
    ],
  },
];

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker = memo(function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return EMOJI_CATEGORIES.flatMap((c) => c.emojis.filter((e) => e.includes(q)));
  }, [search]);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div
      ref={pickerRef}
      className="emoji-picker"
      role="dialog"
      aria-label="Emoji picker"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Search */}
      <div className="emoji-picker-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          aria-label="Search emoji"
          // biome-ignore lint/a11y/noAutofocus: intentional for UX
          autoFocus
        />
      </div>

      {/* Categories */}
      {!search && (
        <div className="emoji-picker-tabs" role="tablist" aria-label="Emoji categories">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.id}
              className={`emoji-picker-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="emoji-picker-grid" role="tabpanel">
        {(filtered ?? EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis ?? []).map(
          (emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-picker-item"
              onClick={() => handleSelect(emoji)}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ),
        )}
      </div>
    </div>
  );
});

/* ─── Inline styles (abstracted as classNames; actual CSS in globals) ─── */

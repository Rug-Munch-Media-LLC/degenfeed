'use client';

export const CATEGORY_TABS = [
  { id: '', label: 'All', emoji: '🌐' },
  { id: 'bitcoin', label: 'Bitcoin', emoji: '₿' },
  { id: 'ethereum', label: 'Ethereum', emoji: '⟠' },
  { id: 'solana', label: 'Solana', emoji: '◎' },
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'nft', label: 'NFTs', emoji: '🖼️' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'macro', label: 'Macro', emoji: '📊' },
  { id: 'tech', label: 'Tech', emoji: '💻' },
  { id: 'security', label: 'Security', emoji: '🛡️' },
  { id: 'regulation', label: 'Regulation', emoji: '⚖️' },
  { id: 'markets', label: 'Markets', emoji: '📈' },
  { id: 'layer2', label: 'L2', emoji: '⚡' },
  { id: 'onchain', label: 'On-Chain', emoji: '🔗' },
  { id: 'memes', label: 'Memes', emoji: '🐸' },
  { id: 'vc', label: 'VC', emoji: '💎' },
  { id: 'privacy', label: 'Privacy', emoji: '👁️' },
];

export function NewsCategoryTabs({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  return (
    <div className="mb-3 flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-800">
      {CATEGORY_TABS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onCategoryChange(c.id)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
            activeCategory === c.id
              ? 'border-degen-500 bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
              : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
          }`}
        >
          {c.emoji} {c.label}
        </button>
      ))}
    </div>
  );
}

'use client';

export function PaywallBadge({ isPaid, premium }: { isPaid?: boolean; premium?: boolean }) {
  if (!isPaid && !premium) return null;
  if (premium) {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
        <span className="text-[8px]">◈</span> Premium
      </span>
    );
  }
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
      <span className="text-[8px]">🔒</span> Paid
    </span>
  );
}

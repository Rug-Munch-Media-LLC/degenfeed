export function VotingStreak() {
  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-bold text-[var(--color-fg)] mb-3">📐 Quadratic Voting</h2>
        <div className="text-center py-2">
          <div className="text-3xl font-black tabular-nums text-degen-400">√10,000</div>
          <div className="text-lg font-bold text-[var(--color-fg)]">= 100 votes</div>
          <div className="text-[10px] text-[var(--color-muted)] mt-1">
            Your voting power with quadratic weighting
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[var(--color-bg)] p-2.5 text-center">
            <div className="text-sm font-bold text-[var(--color-fg)]">10K</div>
            <div className="text-[9px] text-[var(--color-muted)]">Token Balance</div>
          </div>
          <div className="rounded-xl bg-[var(--color-bg)] p-2.5 text-center">
            <div className="text-sm font-bold text-[var(--color-fg)]">100</div>
            <div className="text-[9px] text-[var(--color-muted)]">Voting Credits</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-bold text-[var(--color-fg)] mb-3">📊 DAO Stats</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted)]">Proposal Pass Rate</span>
            <span className="font-bold text-green-500">78%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted)]">Voter Turnout</span>
            <span className="font-bold">42%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted)]">Avg Votes/Proposal</span>
            <span className="font-bold">156</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted)]">Active Members</span>
            <span className="font-bold">342</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-muted)] text-center">
              Voter Turnout Over Time
            </div>
            <div className="flex items-end gap-1.5 h-16 mt-2">
              {[35, 42, 38, 55, 48, 62, 58, 45, 52, 60, 42, 47].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t-sm transition-all ${i === 6 ? 'bg-degen-400' : 'bg-degen-400/40'}`}
                    style={{ height: `${v}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[8px] text-[var(--color-muted)] mt-1">
              <span>Jan</span>
              <span>Dec</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

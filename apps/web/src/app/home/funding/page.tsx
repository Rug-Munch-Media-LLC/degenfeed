"use client";

import { useState, useEffect } from "react";
import { FundingCard, type FundingRound } from "@degenfeed/ui";

export default function FundingPage() {
  const [rounds, setRounds] = useState<FundingRound[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "empty" | "error">("loading");
  const [chainFilter, setChainFilter] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [meta, setMeta] = useState<{ totalRaised?: number }>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const url = new URL("/api/feed/funding", window.location.origin);
        if (chainFilter) url.searchParams.set("chain", chainFilter);
        if (stageFilter) url.searchParams.set("stage", stageFilter);
        url.searchParams.set("limit", "50");
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("API error");
        const data = await res.json() as { data?: FundingRound[]; meta?: any };
        if (cancelled) return;
        if (data.data?.length) {
          setRounds(data.data);
          setMeta(data.meta || {});
          setState("loaded");
        } else {
          setState("empty");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [chainFilter, stageFilter]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <a href="/home" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white">&larr; All sections</a>
        <h1 className="text-2xl font-bold text-white">Funding Tracker</h1>
        <p className="text-sm text-gray-500">Crypto raises, rounds, and investments</p>
        {meta.totalRaised ? (
          <p className="mt-1 text-xs text-degen-500">${meta.totalRaised.toFixed(1)}M total raised (this page)</p>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2">
        {["", "ethereum", "solana", "bitcoin"].map(c => (
          <button key={c} type="button"
            className={"rounded-full px-3 py-1 text-xs font-medium transition-all " + (chainFilter === c ? "bg-degen-500/20 text-degen-500" : "bg-gray-800 text-gray-400 hover:text-white")}
            onClick={() => setChainFilter(c)}>
            {c || "All Chains"}
          </button>
        ))}
      </div>

      {state === "loading" && (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card h-32 animate-pulse" />)}
        </div>
      )}
      {state === "loaded" && (
        <div className="space-y-4">
          {rounds.map(r => <FundingCard key={r.id} round={r} />)}
        </div>
      )}
      {state === "empty" && (
        <div className="card py-12 text-center">
          <div className="mb-4 text-4xl text-gray-600">?</div>
          <p className="text-gray-500">No funding rounds found</p>
        </div>
      )}
      {state === "error" && (
        <div className="card py-12 text-center">
          <p className="text-red-400">Failed to load funding data</p>
          <button type="button" className="btn-primary mt-4 text-sm" onClick={() => setState("loading")}>Retry</button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

interface PriceData {
  usd: number;
  usd_24h_change?: number;
  usd_7d_change?: number;
  usd_30d_change?: number;
  usd_market_cap?: number;
}

// Cache prices in memory to avoid re-fetching
let priceCache: Record<string, PriceData> = {};
let lastFetch = 0;
const CACHE_TTL = 60000;

async function fetchPrices(tickers: string[]): Promise<Record<string, PriceData>> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
    return priceCache;
  }
  try {
    const url = "/api/prices?tickers=" + tickers.join(",");
    const res = await fetch(url);
    const data = await res.json() as { prices?: Record<string, PriceData> };
    if (data.prices) {
      priceCache = { ...priceCache, ...data.prices };
      lastFetch = now;
    }
  } catch {}
  return priceCache;
}

// Regex to find $TICKER patterns in text
const TICKER_RE = /\$([A-Za-z]{2,10})(?:|[^a-zA-Z])/g;

export function PricePill({ ticker, data }: { ticker: string; data?: PriceData }) {
  if (!data) return null;
  const change = data.usd_24h_change;
  const isUp = change !== undefined && change >= 0;
  const color = isUp ? "#22c55e" : "#ef4444";
  const arrow = isUp ? "\u25B2" : "\u25BC";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-mono cursor-help transition-colors hover:opacity-80"
      style={{ backgroundColor: color + "15", color }}
      title={
        "24h: " + (change !== undefined ? change.toFixed(1) + "%" : "N/A") +
        "\n7d: " + (data.usd_7d_change !== undefined ? data.usd_7d_change.toFixed(1) + "%" : "N/A") +
        "\n30d: " + (data.usd_30d_change !== undefined ? data.usd_30d_change.toFixed(1) + "%" : "N/A") +
        "\nMarket Cap: $" + (data.usd_market_cap ? (data.usd_market_cap / 1e9).toFixed(2) + "B" : "N/A")
      }
    >
      {arrow} ${ticker} ${data.usd > 1 ? "$" + data.usd.toLocaleString() : "$" + data.usd.toFixed(6)}
      {change !== undefined && (
        <span className="text-[10px]">({change >= 0 ? "+" : ""}{change.toFixed(1)}%)</span>
      )}
    </span>
  );
}

// Hook to extract tickers from text and fetch prices
export function usePricesForText(text: string): { PricePills: () => React.ReactNode; loading: boolean } {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(false);

  const tickers = [...new Set(
    (text ? Array.from(text.matchAll(TICKER_RE)) : []).map(m => m[1].toUpperCase())
  )].slice(0, 5); // Max 5 price pills per post

  useEffect(() => {
    if (tickers.length === 0) return;
    setLoading(true);
    fetchPrices(tickers).then(data => {
      setPrices(data);
      setLoading(false);
    });
  }, [text]);

  const PricePills = () => {
    if (tickers.length === 0 || Object.keys(prices).length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tickers.map(t => { const d = prices[t as string]; return d ? <PricePill key={t} ticker={t} data={d} /> : null; })}
      </div>
    );
  };

  return { PricePills, loading };
}

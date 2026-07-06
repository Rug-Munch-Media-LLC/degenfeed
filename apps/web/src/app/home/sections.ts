export interface FeedSection {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  endpoint: string;
  limit: number;
  params?: Record<string, string>;
}

export const SECTIONS: FeedSection[] = [
  { id: "all", label: "DegenFeed", icon: "\u25C6", color: "#22c55e", description: "Unified feed across all networks", endpoint: "/api/feed/home", limit: 25, params: { protocols: "nostr,farcaster,lens,bluesky,threads" } },
  { id: "funding", label: "Funding", icon: "\uD83D\uDCB0", color: "#10b981", description: "Crypto raises, rounds, and investments", endpoint: "/api/feed/funding", limit: 25 },
  { id: "top", label: "Best of Web3", icon: "\u2605", color: "#f59e0b", description: "Top posts by cross-protocol engagement (24h)", endpoint: "/api/feed/top", limit: 50 },
  { id: "trending", label: "Trending", icon: "\u26A1", color: "#ef4444", description: "What\u2019s hot right now across all networks", endpoint: "/api/feed/trending", limit: 25 },
  { id: "newsletters", label: "Newsletters", icon: "\uD83D\uDCD0", color: "#8b5cf6", description: "All newsletters", endpoint: "/api/feed/newsletters", limit: 25 },
  { id: "headlines", label: "Headlines", icon: "H", color: "#ef4444", description: "Daily crypto news: CoinDesk, CoinTelegraph, The Block, Decrypt", endpoint: "/api/feed/newsletters", limit: 25, params: { category: "headlines" } },
  { id: "deep-dives", label: "Deep Dives", icon: "D", color: "#f59e0b", description: "Bankless, Week in Eth, Delphi, Messari", endpoint: "/api/feed/newsletters", limit: 25, params: { category: "deep_dives" } },
  { id: "onchain", label: "On-Chain", icon: "O", color: "#10b981", description: "Dune, Glassnode, Token Terminal, Nansen, Artemis", endpoint: "/api/feed/newsletters", limit: 25, params: { category: "onchain_data" } },
  { id: "defi", label: "DeFi", icon: "D", color: "#6366f1", description: "DeFi Pulse, Prime, Llama, Yearn, Uniswap", endpoint: "/api/feed/newsletters", limit: 25, params: { category: "defi" } },
  { id: "ai-crypto", label: "AI x Crypto", icon: "AI", color: "#ec4899", description: "AI/ML in crypto, The Sequence, Modular", endpoint: "/api/feed/newsletters", limit: 25, params: { category: "ai_crypto" } },
  { id: "nostr", label: "Nostr", icon: "\u2630", color: "#8e30eb", description: "Decentralized notes", endpoint: "/api/feed/home", limit: 25, params: { protocols: "nostr" } },
  { id: "farcaster", label: "Farcaster", icon: "\u25C8", color: "#8a63d2", description: "Sufficiently decentralized social", endpoint: "/api/feed/home", limit: 25, params: { protocols: "farcaster" } },
  { id: "lens", label: "Lens", icon: "\u25CE", color: "#abfe2c", description: "User-owned social graph", endpoint: "/api/feed/home", limit: 25, params: { protocols: "lens" } },
  { id: "bluesky", label: "Bluesky", icon: "\u2601", color: "#1185fe", description: "AT Protocol social", endpoint: "/api/feed/home", limit: 25, params: { protocols: "bluesky" } },
  { id: "threads", label: "Threads", icon: "+", color: "#888", description: "Instagram AT Protocol network", endpoint: "/api/feed/threads", limit: 25 },
  { id: "mastodon", label: "Mastodon", icon: "M", color: "#6364ff", description: "Fediverse (GotoSocial)", endpoint: "/api/feed/activitypub", limit: 20, params: { instance: "https://social.degenfeed.xyz", type: "public" } },
  { id: "articles", label: "Reddit", icon: "R", color: "#ff4500", description: "Reddit CryptoCurrency hot posts", endpoint: "/api/feed/rss", limit: 25, params: { source: "reddit", handle: "CryptoCurrency" } },
  { id: "defi-reddit", label: "DeFi Reddit", icon: "D", color: "#6366f1", description: "Reddit DeFi hot posts", endpoint: "/api/feed/rss", limit: 25, params: { source: "reddit", handle: "defi" } },
  { id: "eth-reddit", label: "Eth Reddit", icon: "E", color: "#8b5cf6", description: "Reddit Ethereum hot posts", endpoint: "/api/feed/rss", limit: 25, params: { source: "reddit", handle: "ethereum" } },
];
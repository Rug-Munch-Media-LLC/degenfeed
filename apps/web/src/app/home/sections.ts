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
  { id: "all", label: "DegenFeed", icon: "\u25C6", color: "#22c55e", description: "Everything across all networks", endpoint: "/api/feed/home", limit: 25, params: { protocols: "nostr,farcaster,lens,bluesky,threads" } },
  { id: "nostr", label: "Nostr", icon: "\u2630", color: "#8e30eb", description: "Decentralized notes", endpoint: "/api/feed/home", limit: 25, params: { protocols: "nostr" } },
  { id: "farcaster", label: "Farcaster", icon: "\u25C8", color: "#8a63d2", description: "Sufficiently decentralized social", endpoint: "/api/feed/home", limit: 25, params: { protocols: "farcaster" } },
  { id: "lens", label: "Lens", icon: "\u25CE", color: "#abfe2c", description: "User-owned social graph", endpoint: "/api/feed/home", limit: 25, params: { protocols: "lens" } },
  { id: "bluesky", label: "Bluesky", icon: "\u2601", color: "#1185fe", description: "AT Protocol social", endpoint: "/api/feed/home", limit: 25, params: { protocols: "bluesky" } },
  { id: "threads", label: "Threads", icon: "+", color: "#888", description: "Instagram AT Protocol network", endpoint: "/api/feed/threads", limit: 25 },
  { id: "mastodon", label: "Mastodon", icon: "M", color: "#6364ff", description: "Fediverse (GotoSocial powered)", endpoint: "/api/feed/activitypub", limit: 20, params: { instance: "https://social.degenfeed.xyz", type: "public" } },
  { id: "articles", label: "Articles", icon: "A", color: "#ffa500", description: "RSS, Reddit, Mirror, Substack, Medium, Paragraph", endpoint: "/api/feed/rss", limit: 25, params: { source: "reddit", handle: "CryptoCurrency" } },
];

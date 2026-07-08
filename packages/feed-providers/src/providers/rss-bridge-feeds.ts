/**
 * RSS-Bridge Configuration — Crypto Content Sources
 * 
 * Deployed at http://127.0.0.1:8282 on Talos.
 * 
 * Each bridge URL can be added to the RSS provider's feed list.
 * Format: http://127.0.0.1:8282/?action=display&bridge={BridgeName}&format=Atom&{params}
 * 
 * === Working Bridges (tested) ===
 * 
 * FilterBridge — filter any RSS feed by keyword:
 *   ?action=display&bridge=FilterBridge&format=Atom&url={encoded_rss_url}&filter={keyword}
 * 
 * RedditBridge — subreddit feeds (alternative to Redlib):
 *   ?action=display&bridge=RedditBridge&format=Atom&r={subreddit}&sort=hot
 * 
 * CssSelectorBridge — scrape any website with CSS selectors:
 *   ?action=display&bridge=CssSelectorBridge&format=Atom&url={encoded_url}&selector={css}
 * 
 * === Bridges to configure ===
 * 
 * Farcaster — add Farcaster feed:
 *   ?action=display&bridge=FarcasterBridge&format=Atom&channel={channel_url}
 * 
 * HackerNews — top stories:
 *   ?action=display&bridge=HackerNewsBridge&format=Atom
 * 
 * YouTube — channel videos (alternative to native RSS):
 *   ?action=display&bridge=YoutubeBridge&format=Atom&c={channel_id}
 * 
 * Twitch — streamer clips:
 *   ?action=display&bridge=TwitchBridge&format=Atom&channel={channel_name}
 * 
 * === Curated Bridge Feed URLs (add to DEFAULT_CRYPTO_FEEDS in rss.ts) ===
 */

export const RSS_BRIDGE_FEEDS = [
  // HackerNews top stories (tech/startup news)
  "http://127.0.0.1:8282/?action=display&bridge=HackerNewsBridge&format=Atom",

  // GitHub trending repos (daily)
  "http://127.0.0.1:8282/?action=display&bridge=GithubTrendingBridge&format=Atom",

  // Lobsters (programming community, high signal)
  "http://127.0.0.1:8282/?action=display&bridge=LobstersBridge&format=Atom",

  // Google News — crypto topic
  "http://127.0.0.1:8282/?action=display&bridge=GoogleNewsBridge&format=Atom&q=cryptocurrency&hl=en",

  // YouTube: Bankless
  "http://127.0.0.1:8282/?action=display&bridge=YoutubeBridge&format=Atom&c=UCAl9Ld79qaZxp9JzEOwd3aA",

  // YouTube: Coin Bureau
  "http://127.0.0.1:8282/?action=display&bridge=YoutubeBridge&format=Atom&c=UCqK_GSMbpiV8spgD3ZGloSw",

  // Filter: Cointelegraph → bitcoin only
  "http://127.0.0.1:8282/?action=display&bridge=FilterBridge&format=Atom&url=https%3A%2F%2Fcointelegraph.com%2Frss&filter=bitcoin",

  // Filter: Decrypt → ethereum only  
  "http://127.0.0.1:8282/?action=display&bridge=FilterBridge&format=Atom&url=https%3A%2F%2Fdecrypt.co%2Ffeed&filter=ethereum",

  // Filter: Coindesk → regulation only
  "http://127.0.0.1:8282/?action=display&bridge=FilterBridge&format=Atom&url=https%3A%2F%2Fwww.coindesk.com%2Farc%2Foutboundfeeds%2Frss%2F&filter=regulation",
];

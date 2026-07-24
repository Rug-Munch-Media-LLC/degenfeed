/**
 * Shared utility functions for bridge providers
 *
 * Deduplicates stripHtml, guessNiches, and other common helpers
 * that were copy-pasted across multiple provider files.
 */

// ─── HTML stripping ─────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Niche guessing ────────────────────────────────────────────────────

export function guessNiches(text: string, extraKeywords?: string[]): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|sec\.|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (/\b(lens|hey|orb)\b/.test(lower)) niches.push('lens');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');

  // Extra keywords from context (e.g. subreddit, community name)
  if (extraKeywords) {
    for (const kw of extraKeywords) {
      const kwLower = kw.toLowerCase().trim();
      if (kwLower && !niches.includes(kwLower)) niches.push(kwLower);
    }
  }

  if (niches.length === 0) niches.push('crypto');
  return niches;
}

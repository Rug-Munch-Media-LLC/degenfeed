/**
 * @degenfeed/utils — Niche classification
 *
 * Single responsibility: keyword-based topic tagging for feed items. A pure
 * lookup over the body text plus optional context; no model call.
 */

/**
 * Guess content niches from text using keyword matching.
 *
 * Unions keyword patterns from all protocol adapters for comprehensive
 * detection. Pass optional extra context (e.g., title, tags) to improve
 * detection accuracy.
 *
 * @param text  - Post body/content text to classify
 * @param extra - Optional extra context (title, joined tags, etc.)
 * @returns Array of niche strings (never empty; defaults to ['social'])
 *
 * @example
 * ```ts
 * guessNiches('Bitcoin and blockchain technology')
 * // => ['crypto', 'tech']
 *
 * guessNiches('Just a regular post')
 * // => ['social']
 * ```
 */
export function guessNiches(text: string, extra?: string): string[] {
  const lower = extra ? `${text} ${extra}`.toLowerCase() : text.toLowerCase();
  const n: string[] = [];

  if (/\b(btc|bitcoin|crypto|blockchain|web3|defi|nft|eth|solana|token)\b/.test(lower))
    n.push('crypto');

  if (
    /\b(tech|programming|code|software|linux|foss|self-host|startup|saas|developer|javascript|typescript|webdev|elixir)\b/.test(
      lower,
    )
  )
    n.push('tech');

  if (
    /\b(privacy|surveillance|encryption|security|decentralized|nomadic|federation|permissions)\b/.test(
      lower,
    )
  )
    n.push('privacy');

  if (/\b(fediverse|activitypub|social)\b/.test(lower)) n.push('fediverse');

  if (
    /\b(ai|artificial intelligence|llm|machine learning|gpt|openai|stable diffusion)\b/.test(lower)
  )
    n.push('ai');

  if (
    /\b(art|illustration|drawing|photo|photography|music|creative|writing|manga|anime)\b/.test(
      lower,
    )
  )
    n.push('art');

  if (/\b(gaming|game|games|vtuber|stream|play)\b/.test(lower)) n.push('gaming');

  if (/\b(news|update|report|breaking)\b/.test(lower)) n.push('news');

  if (/\b(identity|ceramic|orbis)\b/.test(lower)) n.push('identity');

  if (/\b(writing|blog|publishing|writer|poetry|essay|journalism)\b/.test(lower)) n.push('writing');

  if (n.length === 0) n.push('social');
  return n;
}

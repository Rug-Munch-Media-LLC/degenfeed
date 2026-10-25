/**
 * @degenfeed/utils — Input validation
 *
 * Single responsibility: cheap syntactic checks. These are shape guards, not
 * deliverability checks.
 */

/**
 * Syntactic email check: one `@`, a dotted domain, a 2+ char TLD, and a
 * 254-character ceiling (RFC 5321 maximum path length).
 */
export function isValidEmail(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

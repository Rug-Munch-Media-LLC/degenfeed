/**
 * @degenfeed/api-worker — DAO Routes (barrel)
 *
 * Thin re-export barrel. Implementation lives in sibling modules:
 *   - dao-core.ts           (types, helpers, CRUD handlers)
 *   - dao-types.ts          (shared types)
 *   - dao-proposals.ts      (proposal + voting handlers)
 *   - dao-delegation.ts     (delegation handlers)
 *   - dao-membership.ts     (join, leave, members list)
 *   - dao-treasury-inline.ts (treasury handlers from original dao.ts)
 *
 * All exports are backward-compatible. app.ts imports from './routes/dao'
 * continue to work unchanged.
 */

export {

/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Engine
 *
 * Thin re-export. The bridge engine has been split into:
 *   - bridge-types.ts    → All shared interfaces and types
 *   - bridge-fetchers.ts  → Source content fetchers (fetchFrom* + fetchSourceContent)
 *   - bridge-publish.ts   → Bridge handlers, Zora handlers, generic publish, main bridge
 *   - bridge-replies.ts   → Reply fetchers per protocol
 */

export { fetchSourceContent } from './bridge-fetchers';
export {
  bridgeContent,
  bridgeContentToAll,
  fetchReplies,
  getBridgeHandler,
  handleBridgeWebhook,
} from './bridge-publish';
export type {
  BridgeContentInput,
  BridgeDirectionHandler,
  BridgeReport,
  BridgeResult,
  CrossProtocolReply,
  SourceContent,
} from './bridge-types';

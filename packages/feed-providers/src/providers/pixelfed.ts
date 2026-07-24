/**
 * @degenfeed/feed-providers — Pixelfed provider barrel
 *
 * Barrel file — re-exports for backward compatibility.
 */

export {
  accountToIdentity,
  normalizePixelfedPost,
  PIXELFED_LOCAL_INSTANCE,
  type PixelfedAccount,
  type PixelfedCard,
  type PixelfedMediaAttachment,
  type PixelfedPoll,
  type PixelfedStatus,
  PUBLIC_PIXELFED_INSTANCES,
} from '@degenfeed/pixelfed-sdk';
export { PixelfedProvider, type PixelfedProviderOptions } from './pixelfed-provider';

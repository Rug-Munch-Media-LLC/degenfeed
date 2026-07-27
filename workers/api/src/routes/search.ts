/**
 * @degenfeed/api-worker — Search Routes
 *
 * Split into module at ./search/ for maintainability.
 * @see ./search/handler.ts
 */

export type {
  IdentityResultItem,
  SearchResultItem,
} from './search/handler';
export {
  handleSearch,
  handleSearchAutocomplete,
  handleSearchIdentity,
} from './search/handler';

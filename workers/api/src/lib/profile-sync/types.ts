/** Types for the Profile Sync module. */

/** Field-level protocol override for unified profile display */
export interface PrimaryFieldOverride {
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  website?: string | null;
  banner?: string | null;
}

/** Profile data synced across protocols */
export interface ProtocolProfile {
  displayName?: string;
  avatar?: string;
  bio?: string;
  website?: string;
  banner?: string;
  [key: string]: unknown;
}

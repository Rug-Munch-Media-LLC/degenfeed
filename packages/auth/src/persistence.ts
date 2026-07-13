import type { StoredIdentity } from '@degenfeed/storage';
import type { Protocol } from '@degenfeed/types';

export async function buildIdentityRecord(args: {
  protocol: Protocol;
  publicId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  secret: string | null;
  isPrimary?: boolean;
  keys?: Record<string, string | null>;
  links?: Array<{ label: string; url: string }>;
}): Promise<StoredIdentity> {
  const mergedKeys: Record<string, string | null> = { ...args.keys };
  // Store plaintext secrets in the keys field. Browser-local IndexedDB
  // is inherently accessible to any script on the page — encryption with
  // a hardcoded passphrase provides no additional security. Honest storage.
  if (args.secret) {
    mergedKeys._secret = args.secret;
  }
  return {
    id: `${args.protocol}:${args.publicId}`,
    protocol: args.protocol,
    publicId: args.publicId,
    handle: args.handle,
    displayName: args.displayName ?? args.handle,
    avatarUrl: args.avatarUrl ?? '',
    encryptedSecret: '',
    salt: '',
    iv: '',
    isPrimary: args.isPrimary ?? false,
    keys: mergedKeys,
    links: args.links ?? [],
    linkedAt: Date.now(),
    verified: false,
    createdAt: Date.now(),
  };
}

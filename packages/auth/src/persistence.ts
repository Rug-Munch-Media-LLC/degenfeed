import type { Protocol } from '@degenfeed/types';
import type { StoredIdentity } from '@degenfeed/storage';
import { encryptSecret } from './crypto';

export async function buildIdentityRecord(args: {
  protocol: Protocol;
  publicId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  secret: string | null;
  passphrase: string;
  isPrimary?: boolean;
  keys?: Record<string, string | null>;
  links?: Array<{ label: string; url: string }>;
}): Promise<StoredIdentity> {
  let encryptedSecret = '';
  let salt = '';
  let iv = '';
  if (args.secret) {
    const blob = await encryptSecret(args.secret, args.passphrase);
    encryptedSecret = blob.ciphertext;
    salt = blob.salt;
    iv = blob.iv;
  }
  return {
    id: args.protocol + ':' + args.publicId,
    protocol: args.protocol,
    publicId: args.publicId,
    handle: args.handle,
    displayName: args.displayName ?? args.handle,
    avatarUrl: args.avatarUrl ?? '',
    encryptedSecret,
    salt,
    iv,
    isPrimary: args.isPrimary ?? false,
    keys: args.keys ?? {},
    links: args.links ?? [],
    linkedAt: Date.now(),
    verified: false,
    createdAt: Date.now(),
  };
}

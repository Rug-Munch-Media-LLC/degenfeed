import { BSKY_PUBLIC_URL, BSKY_SOCIAL_URL, BskyClient } from '@degenfeed/bluesky-sdk';
import type { Protocol } from '@degenfeed/types';

export type { Protocol };

export const THREADS_PUBLIC_URL = 'https://public.threads.net';
export const THREADS_PDS_URL = 'https://threads.net';

export class ThreadsClient {
  private writeClient: BskyClient;

  constructor(pdsUrl: string = THREADS_PDS_URL) {
    this.writeClient = new BskyClient(pdsUrl);
  }

  setAuth(accessJwt: string): void {
    this.writeClient.setAuth(accessJwt);
  }

  like(uri: string, cid: string, actorDid: string): Promise<void> {
    return this.writeClient.like(uri, cid, actorDid);
  }

  unlike(uri: string, actorDid: string): Promise<void> {
    return this.writeClient.unlike(uri, actorDid);
  }

  repost(uri: string, cid: string, actorDid: string): Promise<void> {
    return this.writeClient.repost(uri, cid, actorDid);
  }

  unrepost(uri: string, actorDid: string): Promise<void> {
    return this.writeClient.unrepost(uri, actorDid);
  }

  reply(
    parentUri: string,
    parentCid: string,
    actorDid: string,
    text: string,
    rootUri?: string,
    rootCid?: string,
  ): Promise<void> {
    return this.writeClient.reply(parentUri, parentCid, actorDid, text, rootUri, rootCid);
  }
}

export { BSKY_PUBLIC_URL, BSKY_SOCIAL_URL, BskyClient };

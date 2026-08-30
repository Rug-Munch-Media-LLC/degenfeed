/**
 * ActivityPub Federation Hub
 *
 * A GTS account (@user@social.degenfeed.xyz) is the PRIMARY identity
 * across ALL ActivityPub services. This module handles:
 *
 *   - Identity discovery across fediverse services
 *   - Cross-service profile resolution
 *   - One-account-to-rule-them-all mapping
 *
 * Supported services (all ActivityPub):
 *   GoToSocial, PeerTube, Lemmy, Pixelfed, WriteFreely,
 *   Castopod, Owncast
 */

export interface FediverseIdentity {
  /** Primary GTS handle: @username@social.degenfeed.xyz */
  gtsHandle: string;
  /** GTS account ID */
  gtsId: string;
  /** Resolved URLs on each fediverse service */
  services: Record<string, FediverseServiceProfile | null>;
  /** When the identity was discovered */
  discoveredAt: number;
  /** Whether all services have been checked */
  resolved: boolean;
}

export interface FediverseServiceProfile {
  /** Service name: peertube, lemmy, pixelfed, etc. */
  service: string;
  /** The handle on that service */
  handle: string | null;
  /** The profile URL on that service */
  profileUrl: string | null;
  /** Whether the account exists on that service */
  exists: boolean;
  /** Error if resolution failed */
  error?: string;
}

export interface FederationHubConfig {
  gtsHost: string;
  gtsBase: string;
  /** URL templates for each service's WebFinger / account lookup */
  serviceEndpoints: Record<
    string,
    {
      webfingerTemplate?: string;
      profileUrlTemplate?: string;
      usernameTemplate?: string;
    }
  >;
}

const DEFAULT_CONFIG: FederationHubConfig = {
  gtsHost: 'social.degenfeed.xyz',
  gtsBase: 'http://127.0.0.1:8082',
  serviceEndpoints: {
    peertube: {
      webfingerTemplate:
        'https://video.degenfeed.xyz/.well-known/webfinger?resource=acct:{username}@video.degenfeed.xyz',
      profileUrlTemplate: 'https://video.degenfeed.xyz/accounts/{username}',
      usernameTemplate: '{username}@video.degenfeed.xyz',
    },
    lemmy: {
      webfingerTemplate:
        'https://community.degenfeed.xyz/.well-known/webfinger?resource=acct:{username}@community.degenfeed.xyz',
      profileUrlTemplate: 'https://community.degenfeed.xyz/u/{username}',
      usernameTemplate: '{username}@community.degenfeed.xyz',
    },
    pixelfed: {
      webfingerTemplate:
        'https://photos.degenfeed.xyz/.well-known/webfinger?resource=acct:{username}@photos.degenfeed.xyz',
      profileUrlTemplate: 'https://photos.degenfeed.xyz/{username}',
      usernameTemplate: '{username}@photos.degenfeed.xyz',
    },
    writefreely: {
      webfingerTemplate:
        'https://blog.degenfeed.xyz/.well-known/webfinger?resource=acct:{username}@blog.degenfeed.xyz',
      profileUrlTemplate: 'https://blog.degenfeed.xyz/{username}',
      usernameTemplate: '{username}@blog.degenfeed.xyz',
    },
    castopod: {
      webfingerTemplate:
        'https://podcast.degenfeed.xyz/.well-known/webfinger?resource=acct:{username}@podcast.degenfeed.xyz',
      profileUrlTemplate: 'https://podcast.degenfeed.xyz/@/{username}',
      usernameTemplate: '{username}@podcast.degenfeed.xyz',
    },
    owncast: {
      usernameTemplate: '{username}@live.degenfeed.xyz',
      profileUrlTemplate: 'https://live.degenfeed.xyz/',
    },
    mastodon: {
      webfingerTemplate:
        'https://{instance}/.well-known/webfinger?resource=acct:{username}@{instance}',
      profileUrlTemplate: 'https://{instance}/@{username}',
      usernameTemplate: '{username}@{instance}',
    },
  },
};

/**
 * FederationHub — discover and resolve identities across all ActivityPub services.
 *
 * A user with `@cryptorugmunch@social.degenfeed.xyz` can also be:
 *   @cryptorugmunch@video.degenfeed.xyz (PeerTube)
 *   @cryptorugmunch@community.degenfeed.xyz (Lemmy)
 *   @cryptorugmunch@photos.degenfeed.xyz (Pixelfed)
 *   etc.
 */
export class FederationHub {
  private config: FederationHubConfig;
  /** Cache of resolved identities: gtsHandle -> FediverseIdentity */
  private identityCache = new Map<string, FediverseIdentity>();

  constructor(config?: Partial<FederationHubConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Discover all fediverse identities for a GTS user.
   * Checks WebFinger on each service to confirm the account exists.
   */
  async discoverIdentity(
    username: string,
    gtsId: string,
    _gtsAccessToken?: string,
  ): Promise<FediverseIdentity> {
    const gtsHandle = `@${username}@${this.config.gtsHost}`;
    const cached = this.identityCache.get(gtsHandle);
    if (cached?.resolved) return cached;

    const identity: FediverseIdentity = {
      gtsHandle,
      gtsId,
      services: {},
      discoveredAt: Date.now(),
      resolved: false,
    };

    // Resolve on each configured service
    const results = await Promise.allSettled(
      Object.entries(this.config.serviceEndpoints).map(async ([service, endpoints]) => {
        try {
          return await this.resolveOnService(username, service, endpoints);
        } catch (err) {
          return {
            service,
            handle: null,
            profileUrl: null,
            exists: false,
            error: (err as Error).message,
          } as FediverseServiceProfile;
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        identity.services[result.value.service] = result.value;
      }
    }

    identity.resolved = true;
    this.identityCache.set(gtsHandle, identity);
    return identity;
  }

  /**
   * Check if a username exists on a specific fediverse service via WebFinger.
   */
  private async resolveOnService(
    username: string,
    service: string,
    endpoints: FederationHubConfig['serviceEndpoints'][string],
  ): Promise<FediverseServiceProfile> {
    const handle = endpoints.usernameTemplate
      ? endpoints.usernameTemplate.replace(/\{username\}/g, username)
      : `${username}@${service}.degenfeed.xyz`;

    const profileUrl = endpoints.profileUrlTemplate
      ? endpoints.profileUrlTemplate.replace(/\{username\}/g, username)
      : null;

    // Try WebFinger first
    if (endpoints.webfingerTemplate) {
      const webfingerUrl = endpoints.webfingerTemplate.replace(/\{username\}/g, username);
      try {
        const wfRes = await fetch(webfingerUrl, { signal: AbortSignal.timeout(5000) });
        if (wfRes.ok) {
          const wfData = (await wfRes.json()) as {
            subject?: string;
            links?: Array<{ rel: string; href?: string; type?: string }>;
          };
          return {
            service,
            handle,
            profileUrl:
              wfData.links?.find(
                (l) => l.rel === 'self' || l.rel === 'http://webfinger.net/rel/profile-page',
              )?.href || profileUrl,
            exists: true,
          };
        }
      } catch {
        // WebFinger failed, try direct API
      }
    }

    // If WebFinger fails, try direct API for common services
    try {
      const apiResult = await this.tryDirectApi(service, username);
      if (apiResult) return apiResult;
    } catch {
      // Service not available
    }

    return {
      service,
      handle,
      profileUrl,
      exists: false,
      error: 'Service unavailable or user not found',
    };
  }

  /**
   * Try direct API calls for common services when WebFinger is unavailable.
   */
  private async tryDirectApi(
    service: string,
    username: string,
  ): Promise<FediverseServiceProfile | null> {
    const endpoints: Record<string, { url: string; parser: (data: any) => boolean }> = {
      peertube: {
        url: `https://video.degenfeed.xyz/api/v1/accounts?name=${username}`,
        parser: (data) => data?.accounts?.length > 0,
      },
      lemmy: {
        url: `https://community.degenfeed.xyz/api/v3/user?username=${username}`,
        parser: (data) => data?.person_view != null,
      },
      pixelfed: {
        url: `https://photos.degenfeed.xyz/api/v1/accounts/lookup?acct=${username}`,
        parser: (data) => data?.id != null,
      },
    };

    const ep = endpoints[service];
    if (!ep) return null;

    const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (ep.parser(data)) {
        return {
          service,
          handle: `${username}@${service}.degenfeed.xyz`,
          profileUrl: `https://${service}.degenfeed.xyz/${username}`,
          exists: true,
        };
      }
    }
    return null;
  }

  /**
   * Get cached identity or null if not yet discovered.
   */
  getIdentity(gtsHandle: string): FediverseIdentity | undefined {
    return this.identityCache.get(gtsHandle);
  }

  /**
   * List all discovered identities.
   */
  listIdentities(): FediverseIdentity[] {
    return [...this.identityCache.values()];
  }

  /**
   * Get the unified fediverse handle for a user on any service.
   * Example: getServiceHandle('cryptorugmunch', 'peertube') -> '@cryptorugmunch@video.degenfeed.xyz'
   */
  getServiceHandle(username: string, service: string): string | null {
    const endpoints = this.config.serviceEndpoints[service];
    if (!endpoints?.usernameTemplate) return null;
    return endpoints.usernameTemplate.replace(/\{username\}/g, username);
  }

  /**
   * Generate a human-readable summary of all fediverse identities for a user.
   */
  summarizeIdentity(identity: FediverseIdentity): Array<{
    service: string;
    serviceName: string;
    handle: string | null;
    profileUrl: string | null;
    exists: boolean;
  }> {
    const serviceNames: Record<string, string> = {
      mastodon: 'Mastodon/GoToSocial',
      peertube: 'PeerTube (Video)',
      lemmy: 'Lemmy (Communities)',
      pixelfed: 'Pixelfed (Photos)',
      writefreely: 'WriteFreely (Blogging)',
      castopod: 'Castopod (Podcasts)',
      owncast: 'Owncast (Live Streaming)',
    };

    return Object.entries(identity.services).map(([service, profile]) => ({
      service,
      serviceName: serviceNames[service] || service,
      handle: profile?.handle || null,
      profileUrl: profile?.profileUrl || null,
      exists: profile?.exists || false,
    }));
  }
}

/** Singleton instance — used across all routes */
export const federationHub = new FederationHub();

import { describe, expect, it } from 'vitest';
import {
  APP_BADGE_COLORS,
  AT_PROTOCOL_APPS,
  buildAppDirectoryResponse,
  buildLoginUris,
  getAppByKey,
  getAppCategories,
  getAppDirectory,
} from './atproto-directory';

describe('@degenfeed/bluesky-sdk/atproto-directory', () => {
  describe('AT_PROTOCOL_APPS', () => {
    it('should list known AT Protocol apps', () => {
      expect(AT_PROTOCOL_APPS.length).toBeGreaterThanOrEqual(10);
    });

    it('should include core apps', () => {
      const appKeys = AT_PROTOCOL_APPS.map((a) => a.key);
      expect(appKeys).toContain('bluesky');
      expect(appKeys).toContain('whitewind');
      expect(appKeys).toContain('frontpage');
      expect(appKeys).toContain('smokesignal');
      expect(appKeys).toContain('degenfeed');
    });

    it('every app should have required fields', () => {
      for (const app of AT_PROTOCOL_APPS) {
        expect(app.key).toBeTruthy();
        expect(app.name).toBeTruthy();
        expect(app.description).toBeTruthy();
        expect(app.category).toBeTruthy();
        expect(app.url).toBeTruthy();
        expect(app.lexiconNamespace).toBeTruthy();
        expect(['atproto', 'oauth', 'both']).toContain(app.authType);
      }
    });
  });

  describe('getAppDirectory', () => {
    it('should return all apps when no filter', () => {
      const all = getAppDirectory();
      expect(all).toHaveLength(AT_PROTOCOL_APPS.length);
    });

    it('should filter by category', () => {
      const blogging = getAppDirectory('blogging');
      expect(blogging.length).toBeGreaterThanOrEqual(1);
      expect(blogging.every((a) => a.category === 'blogging')).toBe(true);
    });

    it('should return empty for unused category', () => {
      const dev = getAppDirectory('development');
      expect(dev).toHaveLength(0);
    });
  });

  describe('getAppByKey', () => {
    it('should find bluesky app', () => {
      const app = getAppByKey('bluesky');
      expect(app).toBeDefined();
      expect(app?.name).toBe('Bluesky');
      expect(app?.lexiconNamespace).toBe('app.bsky');
    });

    it('should return undefined for unknown key', () => {
      expect(getAppByKey('nonexistent')).toBeUndefined();
    });
  });

  describe('getAppCategories', () => {
    it('should return all category keys', () => {
      const cats = getAppCategories();
      expect(cats).toContain('microblogging');
      expect(cats).toContain('blogging');
      expect(cats).toContain('events');
    });
  });

  describe('buildLoginUris', () => {
    it('should build URIs for all launched apps', () => {
      const uris = buildLoginUris('did:plc:test-user', 'testuser.degenfeed.xyz');

      // Verify atproto-type apps
      expect(uris.bluesky).toContain('at://');
      expect(uris.bluesky).toContain('did:plc:test-user');

      // Verify oauth-type apps include DID param
      expect(uris.whitewind).toContain('did=');
      expect(uris.whitewind).toContain('testuser.degenfeed.xyz');
    });

    it('should skip unlaunched apps', () => {
      const uris = buildLoginUris('did:plc:test', 'test.degenfeed.xyz');
      expect(Object.keys(uris)).not.toContain('skylight');
    });
  });

  describe('buildAppDirectoryResponse', () => {
    it('should include identity info', () => {
      const resp = buildAppDirectoryResponse('did:plc:test', 'testuser.degenfeed.xyz');
      expect(resp.yourIdentity.did).toBe('did:plc:test');
      expect(resp.yourIdentity.handle).toBe('testuser.degenfeed.xyz');
      expect(resp.totalApps).toBeGreaterThan(0);
      expect(resp.categories.length).toBeGreaterThan(0);
    });

    it('should filter by category', () => {
      const resp = buildAppDirectoryResponse('did:plc:test', 'test.degenfeed.xyz', 'events');
      expect(resp.apps.every((a) => a.category === 'events')).toBe(true);
      expect(resp.apps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('APP_BADGE_COLORS', () => {
    it('should have colors for all launched apps', () => {
      for (const app of AT_PROTOCOL_APPS) {
        if (app.isLaunched) {
          expect(APP_BADGE_COLORS[app.key]).toBeDefined();
        }
      }
    });
  });
});

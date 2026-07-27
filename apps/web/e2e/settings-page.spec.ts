// ═══════════════════════════════════════════════════════════════
// Settings Page E2E Tests — Preferences sections, toggles, save
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import { MOCK_FEED_POSTS, MOCK_PREFERENCES, mockFeedApi } from './fixtures';

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock preferences API
    await page.route('**/api/preferences', async (route) => {
      await route.fulfill({
        json: {
          theme: 'dark',
          fontSize: 'medium',
          layoutDensity: 'comfortable',
          notifications: {
            nostr: { likes: true, replies: true, follows: true, reposts: true, mentions: true },
            farcaster: {
              likes: true,
              replies: true,
              follows: false,
              reposts: true,
              mentions: false,
            },
          },
          privacy: { publicProfile: true, showTipsReceived: true, showFollowers: true },
          content: {
            defaultFeed: 'trending',
            mutedWords: [],
            mutedUsers: [],
            blockedUsers: [],
          },
        },
      });
    });
    // Mock premium status
    await page.route('**/api/premium/status', async (route) => {
      await route.fulfill({ json: { tier: 'free', expiresAt: null } });
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
  });

  test('settings page loads with heading', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Customize your DegenFeed experience')).toBeVisible();
  });

  test('shows all settings section headers', async ({ page }) => {
    await page.goto('/settings');
    // All section should be visible as clickable section headers
    const sections = [
      'Account',
      'Appearance',
      'Notifications',
      'Privacy',
      'Content',
      'Security',
      'Subscription',
      'API',
      'Streaming',
    ];
    for (const section of sections) {
      await expect(page.getByText(section).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('appearance section is open by default', async ({ page }) => {
    await page.goto('/settings');
    // Appearance should be open by default — theme toggles visible
    await expect(page.getByText('Theme').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Font Size').first()).toBeVisible();
    await expect(page.getByText('Layout Density').first()).toBeVisible();
  });

  test('clicking section header toggles section content', async ({ page }) => {
    await page.goto('/settings');
    // Click Account section to expand it
    const accountHeader = page.getByText('Account').first();
    await accountHeader.click();

    // Account section should now show content fields
    await expect(page.getByText('Email').or(page.getByText('Wallet'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('save to server button is visible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('button', { hasText: 'Save to server' })).toBeVisible({
      timeout: 30000,
    });
  });

  test('appearance section has theme selector', async ({ page }) => {
    await page.goto('/settings');
    // Should have theme options (dark/light/system)
    await expect(
      page
        .locator('button')
        .filter({ hasText: /Dark|Light|System/ })
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Settings — signed in state', () => {
  test('shows linked identities when signed in', async ({ page }) => {
    // Mock auth state as signed in
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({
        json: {
          signedInProtocols: { nostr: true, farcaster: true },
          walletAddress: '0x1234',
          primaryIdentity: { id: 'npub1abc', protocol: 'nostr', displayName: 'Alice' },
          linkedIdentities: [
            { id: 'npub1abc', protocol: 'nostr', displayName: 'Alice', isPrimary: true },
            { id: 'fid:123', protocol: 'farcaster', displayName: 'Alice', isPrimary: false },
          ],
        },
      });
    });
    await page.route('**/api/preferences', async (route) => {
      await route.fulfill({ json: {} });
    });
    await page.route('**/api/premium/status', async (route) => {
      await route.fulfill({ json: { tier: 'free' } });
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);

    await page.goto('/settings');
    // Wait for page to render
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 30000 });

    // Account section should have wallet/identity info when expanded
    const accountHeader = page.getByText('Account').first();
    await accountHeader.click({ timeout: 5000 });
    // Should show wallet or protocol information
    await expect(
      page.getByText(/0x1234|npub1abc|Alice/).or(page.getByText(/Wallet|nostr/)),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});

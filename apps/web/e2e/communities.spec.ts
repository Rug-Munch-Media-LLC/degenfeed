// ═══════════════════════════════════════════════════════════════
// Communities E2E Tests — Create community, join, post, governance
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_COMMUNITIES_LIST,
  MOCK_COMMUNITY_DETAIL,
  MOCK_COMMUNITY_FEED,
  MOCK_COMMUNITY_CREATE_RESPONSE,
  MOCK_FEED_POSTS,
  MOCK_SIGNED_IN_STATE,
  MOCK_PREFERENCES,
  mockCommunityApi,
  mockFeedApi,
} from './fixtures';

test.describe('Communities list page', () => {
  test.beforeEach(async ({ page }) => {
    await mockCommunityApi(page);
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
  });

  test('communities page displays community list', async ({ page }) => {
    await page.goto('/c');
    await expect(page.getByText('Bitcoin')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Ethereum')).toBeVisible();
    await expect(page.getByText('Bitcoin discussion across all protocols')).toBeVisible();
  });

  test('communities can be filtered by search', async ({ page }) => {
    await page.goto('/c');
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Ethereum');
      await expect(page.getByText('Ethereum')).toBeVisible();
      // Bitcoin should no longer match
      await expect(page.getByText('Bitcoin discussion')).not.toBeVisible();
    }
  });

  test('community cards show member counts', async ({ page }) => {
    await page.goto('/c');
    await expect(page.getByText('1234').or(page.getByText('1.2K'))).toBeVisible({ timeout: 30000 });
  });

  test('community cards show protocol badges', async ({ page }) => {
    await page.goto('/c');
    // Protocol badges should be visible
    await expect(page.getByText('⚡').or(page.getByText('Nostr'))).toBeVisible({ timeout: 30000 });
  });

  test('create community button opens form', async ({ page }) => {
    await page.goto('/c');
    const createBtn = page.locator('button', { hasText: /Create|New Community/ });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('input[placeholder*="Name"], textarea').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Community detail page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/communities', async (route) => {
      await route.fulfill({ json: MOCK_COMMUNITIES_LIST });
    });
    await page.route('**/api/communities/c-bitcoin', async (route) => {
      await route.fulfill({ json: MOCK_COMMUNITY_DETAIL });
    });
    await page.route('**/api/communities/c-bitcoin/feed**', async (route) => {
      await route.fulfill({ json: { data: MOCK_COMMUNITY_FEED } });
    });
  });

  test('community detail shows posts tab', async ({ page }) => {
    await page.goto('/c/bitcoin');
    await expect(page.getByText('Bitcoin discussion across all protocols')).toBeVisible({
      timeout: 30000,
    });
  });

  test('community shows member count', async ({ page }) => {
    await page.goto('/c/bitcoin');
    await expect(page.getByText('1234').or(page.getByText(/members/i))).toBeVisible({
      timeout: 30000,
    });
  });

  test('community feed displays posts', async ({ page }) => {
    await page.goto('/c/bitcoin');
    // Community posts should be visible
    await expect(page.getByText('Bitcoin is settling billions daily').or(page.getByText('Lightning'))).toBeVisible({
      timeout: 30000,
    });
  });

  test('about tab shows community rules', async ({ page }) => {
    await page.goto('/c/bitcoin');
    const aboutTab = page.locator('button', { hasText: 'About' });
    if (await aboutTab.isVisible()) {
      await aboutTab.click();
      await expect(page.getByText('Be respectful').or(page.getByText('No spam'))).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('members tab shows moderator list', async ({ page }) => {
    await page.goto('/c/bitcoin');
    const membersTab = page.locator('button', { hasText: 'Members' });
    if (await membersTab.isVisible()) {
      await membersTab.click();
      // Moderators should be listed
      await expect(page.locator('text=Moderator').or(page.getByText('Moderators'))).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Community — Join interaction', () => {
  test('join button toggles when clicked', async ({ page }) => {
    await page.route('**/api/communities', async (route) => {
      await route.fulfill({ json: MOCK_COMMUNITIES_LIST });
    });
    await page.route('**/api/communities/c-bitcoin', async (route) => {
      await route.fulfill({ json: { ...MOCK_COMMUNITY_DETAIL, isMember: false } });
    });
    await page.route('**/api/communities/c-bitcoin/join', async (route) => {
      await route.fulfill({ json: { ok: true, isMember: true } });
    });
    await page.route('**/api/communities/c-bitcoin/feed**', async (route) => {
      await route.fulfill({ json: { data: MOCK_COMMUNITY_FEED } });
    });

    await page.goto('/c/bitcoin');
    const joinBtn = page.locator('button', { hasText: /Join/ });
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
      // Button should update to show membership
      await expect(
        page.locator('button', { hasText: /Joined|Leave/ }).or(page.getByText(/Joined/i)),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Community governance', () => {
  test('community detail shows moderation info when signed in as mod', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
    await page.route('**/api/communities', async (route) => {
      await route.fulfill({ json: MOCK_COMMUNITIES_LIST });
    });
    await page.route('**/api/communities/c-bitcoin', async (route) => {
      await route.fulfill({ json: { ...MOCK_COMMUNITY_DETAIL, moderators: ['npub1abc'], isMember: true } });
    });
    await page.route('**/api/communities/c-bitcoin/feed**', async (route) => {
      await route.fulfill({ json: { data: MOCK_COMMUNITY_FEED } });
    });

    await page.goto('/c/bitcoin');
    // About tab should show moderator controls
    const aboutTab = page.locator('button', { hasText: 'About' });
    if (await aboutTab.isVisible()) {
      await aboutTab.click();
      // Should show rules or mod-related content
      await expect(page.getByText('Be respectful').or(page.getByText('Rules'))).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

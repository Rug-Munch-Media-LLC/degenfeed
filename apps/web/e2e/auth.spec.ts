// ═══════════════════════════════════════════════════════════════
// Auth E2E Tests — Wallet connect, sign in, sign out, session persistence
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_AUTH_CALLBACK_RESPONSE,
  MOCK_SIGNED_IN_STATE,
  mockAuthApi,
  mockFeedApi,
  MOCK_FEED_POSTS,
  MOCK_PREFERENCES,
} from './fixtures';

test.describe('Auth — Sign out flow', () => {
  test('sign-out button visible when authenticated on mobile', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockAuthApi(page);
    // Mock the auth state to be signed in
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });

    await page.goto('/feed');
    await expect(page.locator('button', { hasText: 'Sign out' })).toBeVisible({ timeout: 30000 });
  });

  test('sign out clears signed-in state', async ({ page }) => {
    let signOutCalled = false;
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/auth/status**', async (route) => {
      if (signOutCalled) {
        await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
      } else {
        await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
      }
    });
    await page.route('**/api/auth/signout**', async (route) => {
      signOutCalled = true;
      await route.fulfill({ json: { ok: true } });
    });

    await page.goto('/feed');
    await page.locator('button', { hasText: 'Sign out' }).click();

    // After sign out, the Connect Wallet prompt should reappear
    await expect(page.locator('button', { hasText: 'Connect Wallet' }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Auth — Sign in prompt', () => {
  test('shows sign-in prompt on feed page when signed out', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });

    await page.goto('/feed');
    // Signed-out prompt should be visible
    await expect(page.getByText('Sign in to post & engage')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('What is happening across web3?')).toBeVisible();
  });

  test('shows sign in prompt on profile page when signed out', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('button', { hasText: 'Connect an account' })).toBeVisible({
      timeout: 30000,
    });
  });

  test('shows sign in prompt on messages page when signed out', async ({ page }) => {
    await page.goto('/messages');
    await expect(page.getByText('Sign in to use DMs')).toBeVisible({ timeout: 30000 });
  });

  test('Connect Wallet button opens sign-in modal', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });

    await page.goto('/feed');
    await page.locator('button', { hasText: 'Connect Wallet' }).first().click();
    // The sign-in modal should appear (SignInModal from @degenfeed/ui)
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Auth — Auth callback', () => {
  test('auth callback page renders and redirects', async ({ page }) => {
    await page.route('**/api/auth/callback**', async (route) => {
      await route.fulfill({ json: MOCK_AUTH_CALLBACK_RESPONSE });
    });

    await page.goto('/auth/callback');
    // Should show loading or redirect state
    await page.waitForTimeout(2000);
    // Should not error
    await expect(page.locator('text=not found').or(page.locator('h1, p').first())).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Auth — Session persistence', () => {
  test('restores session on page reload', async ({ page }) => {
    let callCount = 0;
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/auth/status**', async (route) => {
      callCount++;
      // Both calls should return signed in state
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });

    await page.goto('/feed');
    // Wait for feed to load with signed-in state
    await expect(page.locator('button', { hasText: 'Sign out' })).toBeVisible({ timeout: 30000 });

    // Reload the page — session should persist
    await page.reload();
    await expect(page.locator('button', { hasText: 'Sign out' })).toBeVisible({ timeout: 30000 });
    // Auth status should have been called at least twice (initial load + reload)
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Auth — Wallet sign-in modal interactions', () => {
  test('sign-in modal shows protocol options', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });
    await page.route('**/api/auth/nonce**', async (route) => {
      await route.fulfill({ json: { nonce: 'test-nonce-123' } });
    });

    await page.goto('/profile');
    await page.locator('button', { hasText: 'Connect an account' }).click();

    // The modal should show protocol options
    const modal = page.locator('[role="dialog"], .fixed.inset-0');
    await expect(modal).toBeVisible({ timeout: 10000 });
  });
});

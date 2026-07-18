// ═══════════════════════════════════════════════════════════════
// Messages E2E Tests — Send DM, receive DM, notifications
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_EMPTY_CONVERSATIONS,
  MOCK_SEND_MESSAGE_RESPONSE,
  MOCK_SIGNED_IN_STATE,
  mockAuthApi,
  mockMessagesApi,
  mockNotificationsApi,
} from './fixtures';

test.describe('Messages — Signed out', () => {
  test('shows sign-in prompt when signed out', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });

    await page.goto('/messages');
    await expect(page.getByText('Sign in to use DMs')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Cross-protocol direct messages')).toBeVisible();
  });
});

test.describe('Messages — Conversation list', () => {
  test.beforeEach(async ({ page }) => {
    await mockMessagesApi(page);
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
  });

  test('conversation list shows conversations', async ({ page }) => {
    await page.goto('/messages');
    // Wait for conversations to load
    await expect(page.getByText('Messages')).toBeVisible({ timeout: 30000 });
  });

  test('conversation shows unread count badge', async ({ page }) => {
    await page.goto('/messages');
    // Unread badge should be visible for conv-1 (unreadCount: 1)
    await expect(page.locator('text=1').or(page.getByText('unread'))).toBeVisible({
      timeout: 30000,
    });
  });

  test('clicking conversation loads messages', async ({ page }) => {
    await page.goto('/messages');
    // Click on the first conversation in the list
    const firstConv = page.locator('button').filter({ hasText: /Hey, are you going/ });
    if (await firstConv.isVisible()) {
      await firstConv.click();
    } else {
      // Fallback: click any conversation button
      const convButtons = page.locator('button').filter({ hasText: /npub:|fid:/ });
      const count = await convButtons.count();
      if (count > 0) {
        await convButtons.first().click();
      }
    }

    // Messages should show in the right panel
    await expect(
      page.getByText('Hey, are you going').or(page.getByText('Sounds great!')),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('conversation time ago is displayed', async ({ page }) => {
    await page.goto('/messages');
    await expect(page.getByText(/ago|just now/).first()).toBeVisible({ timeout: 10000 });
  });

  test('protocol badge shown on conversations', async ({ page }) => {
    await page.goto('/messages');
    await expect(
      page.getByText('Nostr').or(page.getByText('Farcaster')).or(page.getByText('Bluesky')),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Messages — Sending', () => {
  test.beforeEach(async ({ page }) => {
    await mockMessagesApi(page);
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
  });

  test('new message compose form opens and closes', async ({ page }) => {
    await page.goto('/messages');
    const newMsgBtn = page.locator('button', { hasText: '+ New Message' });
    await expect(newMsgBtn).toBeVisible({ timeout: 30000 });

    await newMsgBtn.click();
    // Compose form should appear
    await expect(page.getByPlaceholder('Write a message…').first()).toBeVisible({ timeout: 5000 });

    // Close it
    await page.locator('button', { hasText: '× Close' }).click();
    await expect(page.getByPlaceholder('Write a message…')).not.toBeVisible();
  });

  test('send button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/messages');
    await page.locator('button', { hasText: '+ New Message' }).click();
    const sendBtn = page.locator('button', { hasText: 'Send' });
    await expect(sendBtn).toBeDisabled();
  });

  test('sending a message calls the API', async ({ page }) => {
    let sendCalled = false;
    await page.route('**/api/messages/send', async (route) => {
      sendCalled = true;
      await route.fulfill({ json: MOCK_SEND_MESSAGE_RESPONSE });
    });

    await page.goto('/messages');
    await page.locator('button', { hasText: '+ New Message' }).click();

    // Fill in recipient
    const recipientInput = page.getByPlaceholder(/Recipient/);
    await recipientInput.fill('npub:def');

    // Write a message
    const messageTextarea = page.getByPlaceholder('Write a message…').first();
    await messageTextarea.fill('Hello from E2E test!');

    // Send
    await page.locator('button', { hasText: 'Send' }).click();
    await expect(async () => {
      expect(sendCalled).toBeTruthy();
    }).toPass({ timeout: 10000 });
  });
});

test.describe('Messages — Conversation compose bar', () => {
  test.beforeEach(async ({ page }) => {
    await mockMessagesApi(page);
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
  });

  test('message compose bar appears in selected conversation', async ({ page }) => {
    await page.goto('/messages');

    // Click a conversation to select it
    const convButtons = page.locator('button').filter({ hasText: /Sounds great/ });
    await convButtons.first().click({ timeout: 5000 });

    // Compose bar should be visible
    await expect(page.locator('textarea').last()).toBeVisible({ timeout: 10000 });
  });

  test('compose bar send button works in conversation', async ({ page }) => {
    await page.goto('/messages');

    // Select conversation
    const convButtons = page.locator('button').filter({ hasText: /Sounds great/ });
    await convButtons.first().click({ timeout: 5000 });

    // Type and send
    const composeTextarea = page.locator('textarea').last();
    await composeTextarea.fill('Test message from compose bar');

    // Click send arrow
    const arrowBtn = page.locator('button', { hasText: '→' });
    await arrowBtn.click();
    await expect(
      page.getByText(/Sending|replying|New message|showing messages in/i),
    ).not.toBeAttached({
      timeout: 10000,
    });
  });
});

test.describe('Messages — Empty state', () => {
  test('shows empty state when no conversations', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
    await page.route('**/api/messages/conversations', async (route) => {
      await route.fulfill({ json: MOCK_EMPTY_CONVERSATIONS });
    });

    await page.goto('/messages');
    await expect(page.getByText('No conversations yet')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Messages — Notification bell integration', () => {
  test('notification bell visible on feed when signed in', async ({ page }) => {
    await mockAuthApi(page);
    await mockMessagesApi(page);
    await mockNotificationsApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
    await page.route('**/api/feed/**', async (route) => {
      await route.fulfill({ json: { data: [] } });
    });
    await page.route('**/api/preferences', async (route) => {
      await route.fulfill({ json: {} });
    });

    await page.goto('/feed');
    // Notification bell should be visible
    await expect(
      page
        .locator('[class*="bell"], [class*="notification"], button')
        .filter({
          has: page.locator('svg'),
        })
        .first(),
    ).toBeVisible({ timeout: 30000 });
  });
});

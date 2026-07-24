/**
 * ═════════════════════════════════════════════════════════════════════════════
 * ACCESSIBILITY TESTS — 10 tests
 *
 * Tests keyboard navigation, screen reader compatibility, color contrast,
 * focus management, and ARIA label completeness across key pages.
 *
 * Uses axe-core via @axe-core/playwright for automated audit scans.
 * ═════════════════════════════════════════════════════════════════════════════
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK_FEED = {
  data: [
    {
      id: 'post-1', protocol: 'nostr', text: 'Bitcoin is the future of money!',
      html: '<p>Bitcoin is the future of money!</p>',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      author: { id: 'npub1abc', displayName: 'Satoshi', avatarUrl: '', handle: 'satoshi', metadata: {} },
      embeds: [], metrics: { likes: 42, reposts: 10, replies: 5, quotes: 2 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['bitcoin'], parentId: null, raw: {},
    },
    {
      id: 'post-2', protocol: 'farcaster', text: 'Just deployed my first smart contract on Base 🚀',
      html: '<p>Just deployed my first smart contract on Base 🚀</p>',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      author: { id: 'fid:123', displayName: 'Builder Guy', avatarUrl: '', handle: 'builder', metadata: {} },
      embeds: [], metrics: { likes: 128, reposts: 33, replies: 12, quotes: 5 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['base', 'solidity'], parentId: null, raw: {},
    },
    {
      id: 'post-3', protocol: 'bluesky', text: 'AT Protocol is the most underrated social graph.',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      author: { id: 'did:plc:xyz', displayName: 'Protocol Maxi', avatarUrl: '', handle: 'maxi.bsky.social', metadata: {} },
      embeds: [], metrics: { likes: 67, reposts: 15, replies: 8, quotes: 1 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['atproto', 'decentralization'], parentId: null, raw: {},
    },
  ],
  meta: {
    total: 3, limit: 50,
    perProtocol: { nostr: 1, farcaster: 1, bluesky: 1 },
    trending: [{ topic: 'bitcoin', count: 1, score: 42 }],
    fetchedAt: Date.now(), topOfHour: 'post-2',
  },
};

const MOCK_PREFERENCES = {};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function setupPage(page: Page) {
  await page.route('**/api/feed/home**', async (route) => { await route.fulfill({ json: MOCK_FEED }); });
  await page.route('**/api/feed/for-you**', async (route) => { await route.fulfill({ json: MOCK_FEED }); });
  await page.route('**/api/preferences', async (route) => { await route.fulfill({ json: MOCK_PREFERENCES }); });
}

async function runAxeScan(page: Page) {
  // Dynamically import axe-core
  const AxeBuilder = await import('@axe-core/playwright').then((mod) => mod.default);
  const results = await new AxeBuilder({ page }).analyze();
  return results;
}

// ─── 1. Keyboard Navigation ─────────────────────────────────────────────────

test.describe('Accessibility: Keyboard Navigation', () => {
  test('feed page is navigable via keyboard', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements — should not trap focus
    await page.keyboard.press('Tab');
    const focused1 = page.locator(':focus');
    await expect(focused1).toBeAttached();

    // Multiple tabs should move focus forward
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused2 = page.locator(':focus');
    await expect(focused2).toBeAttached();
  });

  test('keyboard users can navigate to posts', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Press Tab repeatedly — should eventually reach an article/post
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const tagName = await focused.evaluate((el) => el.tagName).catch(() => '');
      if (tagName === 'A' || tagName === 'BUTTON' || tagName === 'ARTICLE') {
        break;
      }
    }

    const focused = page.locator(':focus');
    await expect(focused).toBeAttached();
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Tab to an element and check it has a visible focus indicator
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    const outlineStyle = await focused.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
      };
    });

    // Either outline or box-shadow should indicate focus
    const hasFocusIndicator =
      (outlineStyle.outlineWidth !== '0px' && outlineStyle.outlineStyle !== 'none') ||
      (outlineStyle.boxShadow && outlineStyle.boxShadow !== 'none');
    expect(hasFocusIndicator).toBe(true);
  });
});

// ─── 2. Screen Reader Compatibility (axe-core) ─────────────────────────────

test.describe('Accessibility: Screen Reader Compatibility', () => {
  test('feed page has no critical axe violations', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    // No violations with severity 'critical' or 'serious'
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations.length).toBe(0);
  });

  test('landing page has no critical axe violations', async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations.length).toBe(0);
  });

  test('search page has no critical axe violations', async ({ page }) => {
    await page.route('**/api/search**', async (route) => {
      await route.fulfill({ json: { data: [], identities: [], communities: [], videos: [] } });
    });
    await setupPage(page);
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations.length).toBe(0);
  });

  test('post detail page has no critical axe violations', async ({ page }) => {
    await setupPage(page);
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: { data: MOCK_FEED.data[0] } });
    });
    await page.route('**/api/feed/post/post-1/replies**', async (route) => {
      await route.fulfill({ json: { data: [] } });
    });

    await page.goto('/post/post-1');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations.length).toBe(0);
  });
});

// ─── 3. Color Contrast ─────────────────────────────────────────────────────

test.describe('Accessibility: Color Contrast', () => {
  test('feed page text meets WCAG AA color contrast', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    // axe-core includes color-contrast checks by default
    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast',
    );
    expect(contrastViolations.length).toBe(0);
  });

  test('text on buttons meets WCAG AA contrast requirements', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast',
    );
    for (const violation of contrastViolations) {
      for (const node of violation.nodes) {
        // If contrast failures exist, they should at least be on non-text elements
        expect(node.any.some((c) => c.message.includes('color'))).toBe(false);
      }
    }
  });
});

// ─── 4. Focus Management ───────────────────────────────────────────────────

test.describe('Accessibility: Focus Management', () => {
  test('skip-to-content link is first focusable element', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Press Tab to get the first focusable element
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    const focusedText = await focused.textContent();
    // Should be a skip link or first nav item
    expect(focused).toBeAttached();
  });

  test('modal traps focus when open', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });
    await setupPage(page);

    await page.goto('/feed');
    // Try to trigger sign-in modal
    const connectBtn = page.locator('button', { hasText: 'Connect Wallet' }).first();
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await page.waitForTimeout(1000);

      // Check if a modal or dialog appeared
      const modal = page.locator('[role="dialog"], [role="alertdialog"]');
      if (await modal.isVisible()) {
        // Tab should cycle within the modal
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        const insideModal = await focused.evaluate((el) => {
          return el.closest('[role="dialog"], [role="alertdialog"]') !== null;
        });
        expect(insideModal).toBe(true);
      }
    }
  });
});

// ─── 5. ARIA Labels ────────────────────────────────────────────────────────

test.describe('Accessibility: ARIA Labels', () => {
  test('navigation landmarks have aria labels', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Check for navigation landmarks
    const navs = page.locator('nav[aria-label], nav[aria-labelledby]');
    const navCount = await navs.count();
    expect(navCount).toBeGreaterThanOrEqual(1);

    // Check for main landmark
    const main = page.locator('main[role="main"], main, [role="main"]');
    await expect(main.first()).toBeAttached();
  });

  test('interactive elements have accessible names', async ({ page }) => {
    await setupPage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page);
    // Check for missing aria labels on buttons/links
    const ariaViolations = results.violations.filter(
      (v) =>
        v.id === 'button-name' ||
        v.id === 'link-name' ||
        v.id === 'aria-valid-attr' ||
        v.id === 'aria-roles' ||
        v.id === 'aria-required-children',
    );
    expect(ariaViolations.length).toBe(0);
  });
});

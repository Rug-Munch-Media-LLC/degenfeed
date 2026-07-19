# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> DegenFeed smoke tests >> Mobile navigation >> BottomNav is visible on mobile viewport
- Location: e2e/smoke.spec.ts:299:5

# Error details

```
Error: Playwright Test did not expect test.use() to be called here.
Most common reasons include:
- You are calling test.use() in a configuration file.
- You are calling test.use() in a file that is imported by the configuration file.
- You have two different versions of @playwright/test. This usually happens
  when one of the dependencies in your package.json depends on @playwright/test.
- You are calling test.use() from an async test.describe() block. Only sync ones are supported.
```

# Test source

```ts
  200 |           followers_count: 5678,
  201 |           instance: 'https://bitcoinhackers.org',
  202 |         },
  203 |       ];
  204 | 
  205 |       await page.route('**/api/discover**', async (route) => {
  206 |         await route.fulfill({ json: MOCK_DISCOVER });
  207 |       });
  208 | 
  209 |       await page.goto('/discover');
  210 |       await expect(page.locator('h1', { hasText: 'Fediverse Discovery' })).toBeVisible({
  211 |         timeout: 30000,
  212 |       });
  213 |       await expect(page.locator('text=Alice')).toBeVisible();
  214 |       await expect(page.locator('text=Bob')).toBeVisible();
  215 |     });
  216 |   });
  217 | 
  218 |   test.describe('Videos page', () => {
  219 |     test('renders heading and video grid', async ({ page }) => {
  220 |       await page.route('**/api/feed/home?type=video**', async (route) => {
  221 |         await route.fulfill({ json: MOCK_POSTS });
  222 |       });
  223 | 
  224 |       await page.goto('/videos');
  225 |       await expect(page.locator('h1', { hasText: 'Video' })).toBeVisible({ timeout: 30000 });
  226 |       await expect(page.locator('text=Video Feed')).toBeVisible();
  227 |       await expect(page.locator('article, [class*="rounded-2xl"]').first()).toBeVisible();
  228 |     });
  229 |   });
  230 | 
  231 |   test.describe('News page', () => {
  232 |     test('renders news articles', async ({ page }) => {
  233 |       const MOCK_NEWS = {
  234 |         data: [
  235 |           {
  236 |             id: 'news-1',
  237 |             protocol: 'rss',
  238 |             text: 'Bitcoin reaches new all-time high amid institutional adoption',
  239 |             html: '<p>Bitcoin reaches new all-time high amid institutional adoption</p>',
  240 |             createdAt: new Date().toISOString(),
  241 |             author: {
  242 |               id: 'rss:coindesk',
  243 |               displayName: 'CoinDesk',
  244 |               avatarUrl: '',
  245 |               handle: 'coindesk',
  246 |               metadata: {},
  247 |             },
  248 |             embeds: [
  249 |               {
  250 |                 kind: 'link' as const,
  251 |                 url: 'https://example.com/article',
  252 |               },
  253 |             ],
  254 |             metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
  255 |             engagement: {
  256 |               viewerLiked: false,
  257 |               viewerReposted: false,
  258 |               viewerBookmarked: false,
  259 |             },
  260 |             niches: ['bitcoin'],
  261 |             parentId: null,
  262 |             raw: {},
  263 |           },
  264 |         ],
  265 |         meta: {
  266 |           total: 1,
  267 |           limit: 50,
  268 |           category: 'all',
  269 |           mustRead: false,
  270 |           trending: [],
  271 |           sourceCounts: { rss: 1 },
  272 |           fetchedAt: Date.now(),
  273 |           sources: 1,
  274 |         },
  275 |       };
  276 | 
  277 |       await page.route('**/api/feed/news**', async (route) => {
  278 |         await route.fulfill({ json: MOCK_NEWS });
  279 |       });
  280 | 
  281 |       await page.goto('/news');
  282 |       await expect(page.locator('text=Bitcoin reaches new all-time high')).toBeVisible({
  283 |         timeout: 30000,
  284 |       });
  285 |     });
  286 |   });
  287 | 
  288 |   test.describe('Profile page', () => {
  289 |     test('shows sign-in prompt when not authenticated', async ({ page }) => {
  290 |       await page.goto('/profile');
  291 |       await expect(page.locator('h1', { hasText: 'DegenFeed User' })).toBeVisible({
  292 |         timeout: 30000,
  293 |       });
  294 |       await expect(page.locator('button', { hasText: 'Connect an account' })).toBeVisible();
  295 |     });
  296 |   });
  297 | 
  298 |   test.describe('Mobile navigation', () => {
  299 |     test('BottomNav is visible on mobile viewport', async ({ page }) => {
> 300 |       test.use({ viewport: { width: 390, height: 844 } });
      |            ^ Error: Playwright Test did not expect test.use() to be called here.
  301 | 
  302 |       await page.setViewportSize({ width: 390, height: 844 });
  303 |       await page.goto('/feed');
  304 |       await expect(page.locator('nav[aria-label="Mobile"]')).toBeVisible({ timeout: 30000 });
  305 |       await expect(page.locator('nav[aria-label="Mobile"] a', { hasText: 'Feed' })).toBeVisible();
  306 |       await expect(page.locator('nav[aria-label="Mobile"] a', { hasText: 'News' })).toBeVisible();
  307 |       await expect(page.locator('nav[aria-label="Mobile"] a', { hasText: 'Videos' })).toBeVisible();
  308 |       await expect(
  309 |         page.locator('nav[aria-label="Mobile"] a', { hasText: 'Explore' }),
  310 |       ).toBeVisible();
  311 |     });
  312 |   });
  313 | });
  314 | 
```
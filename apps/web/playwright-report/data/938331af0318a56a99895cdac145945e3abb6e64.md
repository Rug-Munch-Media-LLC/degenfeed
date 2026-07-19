# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> DegenFeed smoke tests >> Discover page >> renders heading and account cards
- Location: e2e/smoke.spec.ts:181:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1').filter({ hasText: 'Fediverse Discovery' })
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('h1').filter({ hasText: 'Fediverse Discovery' })

```

```yaml
- img "logo"
- text: Unlock mysteries wherever you are
- button "Get started":
  - img
- text: Get started Get started with Open WebUI ⓘ Open WebUI does not make any external connections, and your data stays securely on your locally hosted server. Email
- textbox "Email":
  - /placeholder: Enter Your Email
- text: Password Enter Your Password
- textbox "Password Enter Your Password":
  - /placeholder: Enter Your Password
- button "Make password visible in the user interface"
- button "Sign in"
- text: Open WebUI
```

# Test source

```ts
  110 |       },
  111 |       embeds: [],
  112 |       metrics: { likes: 3, reposts: 0, replies: 1, quotes: 0 },
  113 |       engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
  114 |       niches: [],
  115 |       parentId: 'post-2',
  116 |       raw: {},
  117 |     },
  118 |   ],
  119 | };
  120 | 
  121 | const MOCK_SINGLE_POST = {
  122 |   data: MOCK_POSTS.data[0],
  123 | };
  124 | 
  125 | test.describe('DegenFeed smoke tests', () => {
  126 |   test.describe('Feed', () => {
  127 |     test('feed page loads posts and shows For You tab', async ({ page }) => {
  128 |       await page.route('**/api/feed/home**', async (route) => {
  129 |         await route.fulfill({ json: MOCK_POSTS });
  130 |       });
  131 |       await page.route('**/api/preferences', async (route) => {
  132 |         await route.fulfill({ json: {} });
  133 |       });
  134 | 
  135 |       await page.goto('/feed');
  136 |       await expect(page.locator('article').first()).toBeVisible({ timeout: 30000 });
  137 |       await expect(page.locator('button', { hasText: 'For You' })).toBeVisible();
  138 |       await expect(page.locator('h1', { hasText: 'DegenFeed' })).toBeVisible();
  139 |     });
  140 |   });
  141 | 
  142 |   test.describe('Section navigation', () => {
  143 |     test('navigates to /home/nostr and renders section heading', async ({ page }) => {
  144 |       await page.route('**/api/feed/home**', async (route) => {
  145 |         await route.fulfill({ json: MOCK_POSTS });
  146 |       });
  147 |       await page.route('**/api/preferences', async (route) => {
  148 |         await route.fulfill({ json: {} });
  149 |       });
  150 | 
  151 |       await page.goto('/home/nostr');
  152 |       await expect(page.locator('h1', { hasText: 'Nostr' })).toBeVisible({ timeout: 30000 });
  153 |       await expect(page.locator('article').first()).toBeVisible();
  154 |     });
  155 |   });
  156 | 
  157 |   test.describe('Post detail', () => {
  158 |     test('displays post content and replies', async ({ page }) => {
  159 |       await page.route('**/api/feed/home**', async (route) => {
  160 |         await route.fulfill({ json: MOCK_POSTS });
  161 |       });
  162 |       await page.route('**/api/preferences', async (route) => {
  163 |         await route.fulfill({ json: {} });
  164 |       });
  165 |       await page.route('**/api/feed/post/post-1', async (route) => {
  166 |         await route.fulfill({ json: MOCK_SINGLE_POST });
  167 |       });
  168 |       await page.route('**/api/feed/post/post-1/replies**', async (route) => {
  169 |         await route.fulfill({ json: MOCK_REPLIES });
  170 |       });
  171 | 
  172 |       await page.goto('/post/post-1');
  173 |       await expect(page.locator('text=Back to feed')).toBeVisible({ timeout: 30000 });
  174 |       await expect(page.locator('article')).toBeVisible();
  175 |       await expect(page.locator('text=Bitcoin is the future of money!')).toBeVisible();
  176 |       await expect(page.locator('text=replies')).toBeVisible();
  177 |     });
  178 |   });
  179 | 
  180 |   test.describe('Discover page', () => {
  181 |     test('renders heading and account cards', async ({ page }) => {
  182 |       const MOCK_DISCOVER = [
  183 |         {
  184 |           id: '1',
  185 |           username: 'alice',
  186 |           acct: 'alice',
  187 |           display_name: 'Alice',
  188 |           avatar: 'https://example.com/avatar.png',
  189 |           note: 'Crypto enthusiast',
  190 |           followers_count: 1234,
  191 |           instance: 'https://bitcoinhackers.org',
  192 |         },
  193 |         {
  194 |           id: '2',
  195 |           username: 'bob',
  196 |           acct: 'bob',
  197 |           display_name: 'Bob',
  198 |           avatar: 'https://example.com/avatar2.png',
  199 |           note: 'Bitcoin maxi',
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
> 210 |       await expect(page.locator('h1', { hasText: 'Fediverse Discovery' })).toBeVisible({
      |                                                                            ^ Error: expect(locator).toBeVisible() failed
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
  300 |       test.use({ viewport: { width: 390, height: 844 } });
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
```
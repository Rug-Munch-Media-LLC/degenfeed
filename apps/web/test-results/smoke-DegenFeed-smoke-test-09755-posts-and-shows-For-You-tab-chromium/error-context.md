# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> DegenFeed smoke tests >> Feed >> feed page loads posts and shows For You tab
- Location: e2e/smoke.spec.ts:127:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('article').first()
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('article').first()

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
  36  |         metadata: {},
  37  |       },
  38  |       embeds: [],
  39  |       metrics: { likes: 128, reposts: 33, replies: 12, quotes: 5 },
  40  |       engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
  41  |       niches: ['base', 'solidity'],
  42  |       parentId: null,
  43  |       raw: {},
  44  |     },
  45  |     {
  46  |       id: 'post-3',
  47  |       protocol: 'bluesky',
  48  |       text: 'AT Protocol is the most underrated social graph protocol.',
  49  |       createdAt: new Date(Date.now() - 10800000).toISOString(),
  50  |       author: {
  51  |         id: 'did:plc:xyz',
  52  |         displayName: 'Protocol Maxi',
  53  |         avatarUrl: '',
  54  |         handle: 'maxi.bsky.social',
  55  |         metadata: {},
  56  |       },
  57  |       embeds: [],
  58  |       metrics: { likes: 67, reposts: 15, replies: 8, quotes: 1 },
  59  |       engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
  60  |       niches: ['atproto', 'decentralization'],
  61  |       parentId: null,
  62  |       raw: {},
  63  |     },
  64  |   ],
  65  |   meta: {
  66  |     total: 3,
  67  |     limit: 50,
  68  |     perProtocol: { nostr: 1, farcaster: 1, bluesky: 1 },
  69  |     trending: [
  70  |       { topic: 'bitcoin', count: 1, score: 42 },
  71  |       { topic: 'base', count: 1, score: 128 },
  72  |     ],
  73  |     fetchedAt: Date.now(),
  74  |     topOfHour: 'post-2',
  75  |   },
  76  | };
  77  | 
  78  | const MOCK_REPLIES = {
  79  |   data: [
  80  |     {
  81  |       id: 'reply-1',
  82  |       protocol: 'nostr',
  83  |       text: 'Totally agree! Bitcoin fixes this.',
  84  |       createdAt: new Date(Date.now() - 1800000).toISOString(),
  85  |       author: {
  86  |         id: 'npub:def',
  87  |         displayName: 'Bitcoiner',
  88  |         avatarUrl: '',
  89  |         handle: 'bitcoiner',
  90  |         metadata: {},
  91  |       },
  92  |       embeds: [],
  93  |       metrics: { likes: 7, reposts: 1, replies: 0, quotes: 0 },
  94  |       engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
  95  |       niches: [],
  96  |       parentId: 'post-1',
  97  |       raw: {},
  98  |     },
  99  |     {
  100 |       id: 'reply-2',
  101 |       protocol: 'farcaster',
  102 |       text: 'Have you tried deploying on Optimism? Cheaper fees.',
  103 |       createdAt: new Date(Date.now() - 900000).toISOString(),
  104 |       author: {
  105 |         id: 'fid:456',
  106 |         displayName: 'Gas Saver',
  107 |         avatarUrl: '',
  108 |         handle: 'gassaver',
  109 |         metadata: {},
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
> 136 |       await expect(page.locator('article').first()).toBeVisible({ timeout: 30000 });
      |                                                     ^ Error: expect(locator).toBeVisible() failed
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
```
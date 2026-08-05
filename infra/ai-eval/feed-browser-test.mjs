import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(err.message));

await page.goto('http://127.0.0.1:3100/feed', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(5000);

const result = await page.evaluate(() => {
  const postCards = document.querySelectorAll('[data-post-id], article, .post-card, [class*="postCard"], [class*="post-card"]');
  const text = document.body.innerText;
  return {
    postCardCount: postCards.length,
    hasSkeleton: document.body.innerText.includes('Loading') || !!document.querySelector('[class*="skeleton"]'),
    bodyTextPreview: text.slice(0, 600),
    url: location.href,
  };
});

console.log('RESULT:', JSON.stringify(result, null, 2));
console.log('PAGE ERRORS:', JSON.stringify(pageErrors, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors.slice(0, 15), null, 2));
await browser.close();

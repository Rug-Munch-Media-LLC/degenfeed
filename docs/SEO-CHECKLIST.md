# SEO Audit Checklist — DegenFeed

> **Last updated:** 2026-07-18
> **Target:** Rank for web3/crypto social terms (decentralized social network, web3 social media, crypto social platform, etc.)

---

## 1. On-Page SEO

### Title Tags (`<title>`)
- [ ] Every page has a unique, keyword-rich title tag
- [ ] Primary keyword appears at the start of the title
- [ ] Brand name (`— DegenFeed`) appended at the end
- [ ] Title length between 50-60 characters
- [ ] No duplicate titles across pages

### Meta Descriptions
- [ ] Every page has a unique meta description (160 chars max)
- [ ] Primary + secondary keywords naturally included
- [ ] Includes a clear value proposition / CTA
- [ ] No boilerplate or auto-generated descriptions
- [ ] Descriptions match page content accurately

### Heading Hierarchy (`<h1>`–`<h6>`)
- [ ] One `<h1>` per page (brand or primary keyword)
- [ ] Logical hierarchy: h1 → h2 → h3 (no skipping levels)
- [ ] Keywords in headings where natural
- [ ] Headings describe the section content accurately

### Image Alt Text
- [ ] ALL `<img>` tags have descriptive `alt` attributes
- [ ] No empty `alt=""` on content images (decorative only exception)
- [ ] Keywords included where natural (not stuffed)
- [ ] Alt text describes the image content, not just a label

### URL Structure
- [ ] Clean, readable URLs (no query strings for content pages)
- [ ] Keywords in URL path where appropriate
- [ ] Hyphens between words, no underscores
- [ ] Canonical URLs defined on every page

### Structured Data (JSON-LD)
- [ ] `WebApplication` schema on homepage ✓
- [ ] `BreadcrumbList` on all key pages ✓
- [ ] `FAQPage` on /faq ✓
- [ ] `Article` schema on post pages
- [ ] `Organization`/`WebSite` schema on homepage

---

## 2. Technical SEO

### Core Web Vitals
- [ ] LCP < 2.5s (largest contentful paint)
- [ ] FID < 100ms (first input delay)
- [ ] CLS < 0.1 (cumulative layout shift)
- [ ] TTFB < 800ms (time to first byte)
- [ ] INP < 200ms (interaction to next paint)

### Mobile Optimization
- [ ] Responsive design across all breakpoints
- [ ] Touch-friendly buttons (min 44px tap targets)
- [ ] No horizontal scroll on mobile
- [ ] font-size >= 16px on inputs (prevents zoom)
- [ ] Viewport meta tag set correctly ✓

### Page Speed
- [ ] Images lazy-loaded (loading="lazy") ✓
- [ ] Images have explicit width/height (prevents CLS)
- [ ] Fonts use `display: swap` ✓
- [ ] CSS is minified
- [ ] JavaScript is deferred/async where possible
- [ ] No render-blocking resources above the fold
- [ ] Critical CSS inlined ✓

### Indexation
- [ ] `robots.ts` correctly configured ✓
- [ ] Noindex on admin/auth/settings/messages pages ✓
- [ ] `sitemap.xml` generated and submitted ✓
- [ ] Pages are not blocked by robots.txt
- [ ] Canonical URLs prevent duplicate content
- [ ] `hreflang` tags if multi-language

### Performance Budget
- [ ] Total page weight < 500KB (compressed)
- [ ] Less than 50 HTTP requests per page
- [ ] First meaningful paint < 1.5s
- [ ] Time to interactive < 3.5s

### Security
- [ ] HTTPS enforced (no mixed content) ✓
- [ ] CSP headers set appropriately
- [ ] No inline scripts (except critical CSS) ✓
- [ ] Subresource integrity on external scripts

---

## 3. Content SEO

### Keyword Strategy
- [ ] Primary keywords targeted on homepage ✓
- [ ] Secondary keywords on feature pages ✓
- [ ] Long-tail keywords on blog/content pages ✓
- [ ] Protocol-specific keywords (Nostr, Farcaster, Lens, etc.) ✓
- [ ] Branded keywords throughout ✓

### Content Quality
- [ ] Each page has at least 300 words of unique content
- [ ] No thin or duplicate content
- [ ] Internal links between related pages
- [ ] External links to authoritative sources
- [ ] Content updated regularly (feed is real-time ✓)

### Blog / Content Marketing
- [ ] Blog posts target long-tail keywords
- [ ] Each post has a unique meta description
- [ ] Social sharing meta tags configured ✓
- [ ] Articles use proper heading hierarchy
- [ ] Content includes FAQ schema where appropriate

### Semantic HTML
- [ ] `<article>` elements for posts ✓
- [ ] `<nav>` with `aria-label` for navigation ✓
- [ ] `<time>` with `datetime` attribute for timestamps ✓
- [ ] `<main>` element for primary content ✓
- [ ] `<aside>` for complementary content ✓
- [ ] `<header>` and `<footer>` elements ✓
- [ ] ARIA landmarks for screen readers ✓

### Rich Snippets
- [ ] BreadcrumbList schema ✓
- [ ] FAQPage schema ✓
- [ ] WebApplication schema ✓
- [ ] Article schema (for blog/news)
- [ ] Review/rating schema (for testimonials)
- [ ] Product schema (for premium tiers)

---

## 4. Off-Page SEO

### Backlink Strategy
- [ ] Submit to web3/crypto directories
- [ ] Guest posts on crypto blogs
- [ ] Open source repo backlinks (GitHub/Forgejo)
- [ ] Social media profiles (Twitter, Farcaster, etc.)
- [ ] Community forum mentions (Reddit, Stack Overflow)
- [ ] Product hunt / alternative.to listings
- [ ] Crunchbase / G2 / Capterra listings

### Social Signals
- [ ] Open Graph tags for social sharing ✓
- [ ] Twitter Card tags configured ✓
- [ ] Share buttons on content pages
- [ ] Active social media presence
- [ ] Social proof (testimonials, user count) ✓

### Brand Mentions
- [ ] Monitor brand mentions (Google Alerts, etc.)
- [ ] Engage with mentions (reply, share)
- [ ] Encourage user-generated content
- [ ] PR and media outreach to crypto publications

### Local/Business Listings
- [ ] Google Business Profile (if applicable)
- [ ] Crunchbase company profile
- [ ] LinkedIn company page
- [ ] GitHub/Forgejo organization page ✓

---

## 5. Keyword Tracking

### Tools & Methods
- [ ] Google Search Console — track impressions/clicks
- [ ] Plausible analytics — track organic traffic ✓
- [ ] Rank tracking tool (e.g., SERPWatcher, AccuRanker)
- [ ] Manual keyword rank checks (incognito)

### Keywords to Track (Top Priority)

| Keyword | Current Rank | Target | Page |
|---------|-------------|--------|------|
| web3 social media | — | Top 10 | Homepage |
| decentralized social network | — | Top 10 | Homepage |
| crypto social platform | — | Top 10 | Homepage |
| blockchain social media | — | Top 15 | Homepage |
| nostr feed | — | Top 5 | /nostr |
| farcaster feed | — | Top 5 | /farcaster |
| lens protocol | — | Top 10 | /lens |
| bluesky feed | — | Top 10 | /bluesky |
| crypto news feed | — | Top 15 | /feed |
| web3 content aggregator | — | Top 10 | /feed |
| crypto tipping | — | Top 10 | (tipping page) |
| decentralized twitter alternative | — | Top 10 | Homepage |
| fediverse aggregator | — | Top 5 | Homepage |
| cross protocol social | — | Top 10 | Homepage |

### Tracking Schedule
- [ ] Weekly: Check rankings for top 10 keywords
- [ ] Monthly: Full keyword audit (all tracked keywords)
- [ ] Quarterly: Competitor analysis and keyword gap analysis
- [ ] Monthly: Review Search Console performance report

---

## 6. Ongoing SEO Maintenance

### Weekly
- [ ] Monitor Google Search Console for errors
- [ ] Check Plausible analytics for organic traffic trends
- [ ] Review crawl stats and index coverage
- [ ] Fix any 404 errors or broken internal links

### Monthly
- [ ] Full keyword rank check
- [ ] Content audit — update thin/outdated pages
- [ ] Review and update meta descriptions for low-CTR pages
- [ ] Check backlink profile for toxic links
- [ ] Analyze competitor SEO strategies

### Quarterly
- [ ] Comprehensive technical SEO audit
- [ ] Core Web Vitals performance review
- [ ] Update keyword strategy based on performance
- [ ] Content gap analysis vs competitors
- [ ] Schema markup audit (validate all structured data)

### Annually
- [ ] Full site architecture review
- [ ] Content strategy refresh
- [ ] Link building strategy update
- [ ] SEO tool stack evaluation

---

## 7. Quick Wins (Immediate Actions)

- [x] Optimize title tags with primary keywords
- [x] Add keyword-rich meta descriptions to all key pages
- [x] Fix empty alt text on images
- [x] Add breadcrumb structured data
- [x] Add FAQ structured data to /faq
- [x] Create SEO keyword map (`src/lib/seo-keywords.ts`)
- [ ] Submit sitemap to Google Search Console
- [ ] Set up Google Search Console if not done
- [ ] Add `Article` schema to blog/news content
- [ ] Add `Organization` schema to homepage
- [ ] Create dedicated /tipping page with crypto tipping keywords
- [ ] Create dedicated /analytics page with web3 analytics keywords
- [ ] Add internal links between protocol pages
- [ ] Compress images and enable WebP/AVIF
- [ ] Enable HTTP/2 or HTTP/3
- [ ] Add breadcrumb navigation UI (not just structured data)

---

## 8. Keyword Cannibalization Check

Ensure multiple pages don't target the same keyword:

| Keyword | Primary Page | Secondary Pages | Status |
|---------|-------------|-----------------|--------|
| nostr feed | /nostr | /feed (partial) | ✓ OK |
| farcaster feed | /farcaster | /feed (partial) | ✓ OK |
| web3 social | / | (brand) | ✓ OK |
| crypto tips | TBD | / (hero section) | ⚠️ Need /tipping page |

---

## Resources

- **Keyword Map:** `/apps/web/src/lib/seo-keywords.ts`
- **Sitemap:** `https://app.degenfeed.xyz/sitemap.xml`
- **Robots:** `https://app.degenfeed.xyz/robots.txt`
- **Google Search Console:** (TBD)
- **Plausible Analytics:** `https://plausible.rugmunch.io` ✓
- **PageSpeed Insights:** `https://pagespeed.web.dev/`

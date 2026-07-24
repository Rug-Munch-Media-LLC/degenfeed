# WordPress Integration — DegenFeed Plugin Concept

Embed your DegenFeed cross-protocol content feed directly into any WordPress site.
Display your unified Nostr + Farcaster + Bluesky + Lens + RSS feed as a WordPress
widget, shortcode, or full-page embed.

> **Status:** Concept / Design Doc  
> **Target:** WordPress plugin published on WordPress.org + GitHub  
> **License:** GPL v2+

---

## Why WordPress?

WordPress powers 43% of all websites. If DegenFeed content can appear in WordPress,
every creator with a WordPress site can display their cross-protocol feed without
switching platforms. This is the easiest distribution play — meet users where they are.

### Use Cases

1. **Blogger** — embeds their Nostr/Farcaster feed in their WordPress sidebar
2. **News site** — shows real-time Bluesky updates alongside articles
3. **Creator** — embeds DegenFeed Tip button in WordPress posts
4. **Community** — displays fediverse ActivityPub feed from their GoToSocial instance
5. **Portfolio** — shows cross-platform content stream on their about page

---

## Plugin Architecture

```
WordPress Site
    │
    ├── DegenFeed Plugin
    │   ├── Shortcode: [degenfeed_feed]
    │   ├── Widget:    DegenFeed Feed Widget (drag-and-drop)
    │   ├── Gutenberg: DegenFeed Feed Block
    │   └── Settings Panel: Configure instance URL, theme, filters
    │
    ├── API Proxy (WordPress REST API endpoint)
    │   └── Proxies requests to DegenFeed instance (avoids CORS)
    │
    └── Frontend Rendering
        └── React component (micro-frontend) OR plain JS embed
```

### Two Rendering Options

#### Option A: Full React Embed (Rich)

The DegenFeed React component is bundled as a standalone JS file and loaded
on the WordPress page. This gives the full DegenFeed experience — real-time
updates, interactive posts, tip buttons, media previews.

```html
<!-- WordPress shortcode renders: -->
<div id="degenfeed-feed" 
     data-instance="https://alice.xyz"
     data-theme="dark"
     data-filters="nostr,farcaster"
     data-limit="20">
</div>
<script src="https://alice.xyz/embed.js" async></script>
```

**Pros:** Full interactivity, real-time, theming  
**Cons:** Heavier page load, requires JS

#### Option B: Server-Side Render (Lightweight)

WordPress fetches feed data server-side (via REST API or direct HTTP) and
renders HTML directly. No JavaScript required for basic display.

```php
<?php echo do_shortcode('[degenfeed_feed instance="https://alice.xyz" limit="10"]'); ?>
```

Renders as static HTML with links to DegenFeed for interactivity.

**Pros:** Lightweight, works without JS, SEO-friendly  
**Cons:** Static content (no real-time updates), fewer interactions

---

## Shortcode API

```
[degenfeed_feed]
    instance="https://alice.xyz"          # DegenFeed instance URL (required)
    username="alice"                      # Filter by username
    limit="20"                            # Number of posts (default: 20)
    columns="1"                           # Layout columns (1, 2, 3)
    theme="dark"                          # Theme: light, dark, auto
    filters="nostr,farcaster,bluesky"    # Protocol filter (comma-separated)
    show_avatars="true"                   # Show author avatars
    show_tips="true"                      # Show tip button
    show_timestamps="true"                # Show relative timestamps
    height="600"                          # Max height (scrollable)
    class=""                              # Additional CSS classes
]
```

### Examples

```php
// Basic feed — latest 10 posts
[degenfeed_feed instance="https://alice.xyz"]

// Nostr-only feed in sidebar
[degenfeed_feed instance="https://alice.xyz" filters="nostr" limit="5"]

// Full-width grid with tips enabled
[degenfeed_feed instance="https://alice.xyz" columns="2" show_tips="true" limit="30"]

// Dark-themed Bluesky feed
[degenfeed_feed instance="https://alice.xyz" filters="bluesky" theme="dark"]
```

---

## Gutenberg Block

The plugin registers a custom Gutenberg block for the WordPress block editor.

### Block Controls

| Setting | Control Type | Description |
|---------|-------------|-------------|
| Instance URL | Text Input | DegenFeed instance URL |
| Username | Text Input | Filter by username |
| Protocol Filter | Multi-select | Nostr, Farcaster, Bluesky, Lens, RSS |
| Theme | Select | Light, Dark, Auto |
| Columns | Range Slider | 1-3 columns |
| Post Limit | Range Slider | 5-50 posts |
| Show Avatars | Toggle | Enable/disable avatars |
| Show Tips | Toggle | Enable/disable tip button |
| Max Height | Text Input | Container max height in px |

### Block Preview

The block renders a live preview in the Gutenberg editor showing the feed
as it will appear on the frontend.

---

## Widget

A classic WordPress widget for sidebar/footer placement.

### Widget Form

- Instance URL (text)
- Title (text, default: "DegenFeed")
- Username (optional text)
- Protocol filter (checkbox group)
- Number of posts (number, default: 5)
- Theme (select: light/dark)
- Show avatars (checkbox)
- Show timestamps (checkbox)

### Widget Rendering

Same underlying rendering engine as the shortcode — configured via widget
form fields instead of shortcode attributes.

---

## Settings Panel

WordPress Admin → Settings → DegenFeed

### General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Default Instance URL | — | DegenFeed instance to use when not specified |
| Cache TTL | 300s | How long to cache feed data |
| Embed Mode | `react` or `static` | Rendering engine |
| Default Theme | `dark` | Theme for embedded feeds |
| Enable CDN | On | Load embed.js from CDN or locally |

### API Settings

| Setting | Description |
|---------|-------------|
| API Proxy Enabled | Routes feed requests through WordPress to avoid CORS |
| API Key (optional) | If DegenFeed instance requires authentication |

### Display Settings

| Setting | Description |
|---------|-------------|
| Default columns | Default layout columns |
| Show tips by default | Show tip button on posts |
| Show timestamps | Show relative timestamps |
| Loading indicator | Spinner, skeleton, or none |

---

## Embed Script (JavaScript)

For non-WordPress sites, the embed script can be used standalone:

```html
<!-- Any website -->
<div id="degenfeed-feed" 
     data-instance="https://alice.xyz"
     data-filters="nostr,farcaster">
</div>
<script src="https://alice.xyz/embed.js" async></script>
```

The embed.js is served by the DegenFeed instance itself. It:

1. Reads configuration from `data-*` attributes on the container div
2. Fetches feed data from the DegenFeed API
3. Renders the feed as a shadow-DOM encapsulated component
4. Periodically polls for new content
5. Handles responsive layout and theme

---

## Data Flow

```
User visits WordPress page with [degenfeed_feed]
                    │
                    ▼
WordPress renders shortcode → outputs HTML placeholder
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    Option A (React)    Option B (Static)
          │                   │
    Loads embed.js      WordPress queries
    from instance       DegenFeed API
          │                   │
    React renders        PHP renders
    feed in browser      HTML on server
          │                   │
    Real-time           Static HTML
    updates via         sent to browser
    polling/SSE         (no JS needed)
```

### Cache Strategy

| Level | Cache | TTL |
|-------|-------|-----|
| Browser | `Cache-Control` headers | 60s |
| WordPress Transients | `wp_cache_set()` | 300s |
| CDN (if enabled) | Cloudflare/CloudFront | 60s |
| DegenFeed Instance | Redis | 30s |

---

## REST API Endpoints

The plugin registers WordPress REST API endpoints for JavaScript clients:

```
GET /wp-json/degenfeed/v1/feed
  ?instance=https://alice.xyz
  &username=alice
  &filters=nostr,farcaster
  &limit=20

Response: {
  "posts": [...],
  "total": 42,
  "cached": true,
  "instance": "https://alice.xyz"
}

GET /wp-json/degenfeed/v1/health
Response: { "status": "ok", "version": "0.1.0" }
```

---

## Security Considerations

### Input Validation

- Instance URL: validate against URL scheme + hostname allowlist
- Username: alphanumeric + `@` + `.` only
- Filters: match against known protocol list
- Limit: clamp to 1-100

### XSS Prevention

- All feed content rendered via `wp_kses()` with an allowlist
- External links get `rel="noopener noreferrer nofollow"`
- User content (names, bios) sanitized before rendering
- If using React, DOMPurify on all external content

### API Proxy Security

- Proxy only to allowed instance URLs (configurable allowlist)
- Rate limit: 30 requests/minute per IP
- Cache responses to reduce load on DegenFeed instance

### Data Privacy

- No user data stored in WordPress
- Feed data cached in transients (not persistent storage)
- No tracking or analytics injected
- All requests go directly to the configured DegenFeed instance

---

## Performance

### Impact of Embed Options

| Option | Page Load | Impact | Best For |
|--------|-----------|--------|----------|
| Static (no JS) | +5-20ms | Minimal | Sidebars, footers |
| React embed | +200-500ms | Moderate | Main content areas |
| Multiple feeds | +100ms each | Cumulative | Limit to 2 per page |

### Recommendations

1. Use static rendering for sidebars/footers
2. Use React embed only for primary content areas
3. Limit to 2 feeds per page
4. Enable WordPress object cache (Redis/Memcached) for API proxy performance
5. Set `show_avatars="false"` reduces image requests significantly

---

## Development Roadmap

### Phase 1: Core Plugin (2 weeks)

- [x] Shortcode `[degenfeed_feed]` with all attributes
- [x] Widget for sidebar/footer
- [x] Settings panel with defaults
- [x] Static rendering (server-side)
- [x] API proxy endpoint
- [x] Cache layer (WordPress transients)
- [x] i18n support

### Phase 2: Enhanced Embed (2 weeks)

- [ ] React embed.js with shadow DOM
- [ ] Gutenberg block with preview
- [ ] Real-time updates via polling
- [ ] Tip button integration
- [ ] Responsive grid layouts
- [ ] Theme customization in settings

### Phase 3: Polish (1 week)

- [ ] WordPress.org plugin review readiness
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance optimization
- [ ] Documentation + screenshots
- [ ] Translation-ready strings
- [ ] Readme.txt for WordPress.org

---

## Technical Requirements

### WordPress

| Requirement | Minimum |
|-------------|---------|
| WordPress | 5.8+ (Block Editor) |
| PHP | 8.0+ |
| Memory | 32MB (for API caching) |

### DegenFeed Instance

| Feature | Required? |
|---------|-----------|
| Public API | ✅ (feed endpoint) |
| CORS headers | ✅ (to allow embeds) |
| Embed.js | ✅ (for React rendering) |
| API key auth | Optional |

### Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ |
| Firefox 88+ | ✅ |
| Safari 14+ | ✅ |
| Edge 90+ | ✅ |
| IE 11 | ❌ |

---

## Monetization

### Free Tier

- Basic shortcode + widget (static rendering)
- Single feed per page
- Up to 20 posts per feed
- Cache at 300s

### Pro ($5/mo)

- React embed with real-time updates
- Gutenberg block
- Multiple feeds per page
- Tip button integration
- Priority support

### Enterprise (Custom)

- White-label embeds (no DegenFeed branding)
- Custom CSS themes
- Dedicated API proxy
- SLA-backed uptime
- Custom development

---

## Getting Started (Plugin Development)

```bash
# Clone the plugin skeleton
mkdir degenfeed-wp-plugin
cd degenfeed-wp-plugin

# Core plugin files
touch degenfeed-feed.php          # Main plugin file
touch readme.txt                   # WordPress.org readme
touch includes/shortcode.php       # Shortcode handler
touch includes/widget.php         # Widget class
touch includes/settings.php       # Settings panel
touch includes/api-proxy.php      # REST API proxy
touch includes/cache.php          # Cache layer
touch assets/embed.js             # React embed script
touch assets/style.css            # Plugin styles
touch languages/                  # i18n directory

# Plugin bootstrap
cat > degenfeed-feed.php << 'PLUGIN'
<?php
/**
 * Plugin Name:     DegenFeed
 * Plugin URI:      https://degenfeed.xyz/wordpress
 * Description:     Embed your cross-protocol DegenFeed content in WordPress.
 * Version:         0.1.0
 * Author:          DegenFeed
 * Author URI:      https://degenfeed.xyz
 * License:         GPL v2 or later
 * Text Domain:     degenfeed-feed
 */

defined('ABSPATH') || exit;

define('DEGENFEED_VERSION', '0.1.0');
define('DEGENFEED_PLUGIN_DIR', plugin_dir_path(__FILE__));

// Load includes
require_once DEGENFEED_PLUGIN_DIR . 'includes/shortcode.php';
require_once DEGENFEED_PLUGIN_DIR . 'includes/widget.php';
require_once DEGENFEED_PLUGIN_DIR . 'includes/settings.php';
require_once DEGENFEED_PLUGIN_DIR . 'includes/api-proxy.php';
require_once DEGENFEED_PLUGIN_DIR . 'includes/cache.php';

// Register shortcode
add_action('init', 'degenfeed_register_shortcode');

// Register widget
add_action('widgets_init', function() {
    register_widget('DegenFeed_Widget');
});

// Enqueue assets
add_action('wp_enqueue_scripts', 'degenfeed_enqueue_assets');

function degenfeed_enqueue_assets() {
    if (is_admin()) return;
    wp_register_style('degenfeed-feed', plugins_url('assets/style.css', __FILE__), [], DEGENFEED_VERSION);
}
PLUGIN
```

---

## FAQ

### Do I need a DegenFeed account?

Yes. You need a DegenFeed instance (self-hosted or at app.degenfeed.xyz).
The plugin embeds feeds from existing DegenFeed accounts.

### Can I embed feeds from different creators?

Yes. Each shortcode/widget instance can point to a different DegenFeed
instance via the `instance` parameter.

### Does the plugin store user data?

No. Feed data is cached temporarily (default: 5 minutes) in WordPress
transients. No user data is stored or transmitted.

### Does it work with caching plugins?

Yes. The static rendering output is cacheable by WP Rocket, W3 Total Cache,
etc. React embeds bypass page cache.

### Is there a headless mode?

Yes. The plugin registers REST API endpoints that return JSON feed data,
suitable for headless WordPress setups with any frontend framework.

### Can I style the feed?

Yes. The feed container has CSS classes for customization. If using React
embeds, themes can be passed via shortcode attributes.

---

## Support

| Channel | Purpose |
|---------|---------|
| [GitHub](https://github.com/RugMunchMedia/degenfeed-web) | Plugin issues, PRs |
| [WordPress.org](https://wordpress.org/plugins/degenfeed-feed) | Plugin page |
| [Discord](https://discord.gg/degenfeed) | Community support |

---

*Built for creators who own their stack. Now available wherever you publish.*

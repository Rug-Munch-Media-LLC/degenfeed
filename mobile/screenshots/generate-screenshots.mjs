/**
 * DegenFeed App Store Screenshot Generator
 *
 * Generates placeholder screenshots for App Store & Play Store submission.
 * Run with: node generate-screenshots.mjs
 *
 * Uses `canvas` (node-canvas) for rendering. If canvas is not installed,
 * run: pnpm add -D canvas  (or: npm install -g canvas)
 *
 * For production screenshots, replace these placeholders with actual
 * renders from the app running in a simulator/device.
 */

import { createCanvas, registerFont, loadImage } from 'canvas';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Brand Colors ───────────────────────────────────────────────
const COLORS = {
  bg: '#030712',          // gray-950
  surface: '#1f2937',     // gray-800
  surfaceLight: '#374151', // gray-700
  border: '#4b5563',      // gray-600
  text: '#f9fafb',        // gray-50
  textMuted: '#9ca3af',   // gray-400
  degen: '#00ff41',       // brand green
  degenDark: '#00cc34',
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
};

// ── Device Definitions ─────────────────────────────────────────
const DEVICES = [
  { id: 'iphone6.7', width: 1290, height: 2796, label: 'iPhone 6.7"' },
  { id: 'iphone6.5', width: 1242, height: 2688, label: 'iPhone 6.5"' },
  { id: 'iphone5.5', width: 1242, height: 2208, label: 'iPhone 5.5"' },
  { id: 'ipad12.9', width: 2048, height: 2732, label: 'iPad Pro 12.9"' },
  { id: 'phone',    width: 1080, height: 2340, label: 'Android Phone' },
  { id: 'tablet7',  width: 1200, height: 1920, label: 'Android Tablet 7"' },
  { id: 'tablet10', width: 1600, height: 2560, label: 'Android Tablet 10"' },
];

// iPad excludes: post, profile, messages (only feed + discover required)
const PAGES = ['feed', 'post', 'discover', 'profile', 'messages'];

// ── Drawing Helpers ────────────────────────────────────────────

function drawStatusBar(ctx, w) {
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, 0, w, 60);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('9:41', w - 24, 40);
  ctx.textAlign = 'left';
  ctx.fillText('DegenFeed', 24, 40);
}

function drawNavBar(ctx, w, h) {
  const barY = h - 100;
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, barY, w, 100);

  const tabs = [
    { label: 'Feed', icon: '☰', active: false },
    { label: 'Discover', icon: '◉', active: false },
    { label: 'Post', icon: '✚', active: false },
    { label: 'Messages', icon: '✉', active: false },
    { label: 'Profile', icon: '●', active: false },
  ];

  const tabW = w / tabs.length;
  tabs.forEach((tab, i) => {
    const x = tabW * i + tabW / 2;
    ctx.fillStyle = tab.active ? COLORS.degen : COLORS.textMuted;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tab.icon, x, barY + 40);
    ctx.font = '16px sans-serif';
    ctx.fillText(tab.label, x, barY + 72);
  });
}

function drawMockPost(ctx, x, y, w, protocol, username, text, time) {
  const cardH = 160;
  const radius = 16;

  // Card background
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, x + 16, y, w - 32, cardH, radius);
  ctx.fill();

  // Protocol badge
  const protocolColors = {
    nostr: COLORS.nostr,
    farcaster: COLORS.farcaster,
    lens: COLORS.lens,
    bluesky: COLORS.bluesky,
    mastodon: COLORS.mastodon,
  };
  ctx.fillStyle = protocolColors[protocol] || COLORS.textMuted;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(protocol.toUpperCase(), x + 32, y + 28);

  // Username
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(username, x + 32, y + 56);

  // Time
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(time, w - 32, y + 28);

  // Content text
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  wrapText(ctx, text, x + 32, y + 84, w - 64, 22, 3);

  // Action bar
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('♡ 42', x + 32, y + cardH - 16);
  ctx.textAlign = 'center';
  ctx.fillText('↻ 12', x + w / 2 - 32, y + cardH - 16);
  ctx.textAlign = 'right';
  ctx.fillText('✉ 8', w - 32, y + cardH - 16);
}

function drawMockDiscoverCard(ctx, x, y, w, title, subtitle, color) {
  const cardH = 100;
  ctx.fillStyle = color || COLORS.surfaceLight;
  roundRect(ctx, x + 16, y, w - 32, cardH, 12);
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 36, y + 42);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '15px sans-serif';
  ctx.fillText(subtitle, x + 36, y + 72);
}

function drawMockMessage(ctx, x, y, w, name, preview, time) {
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(x + 16, y, w - 32, 72);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(name, x + 72, y + 30);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '15px sans-serif';
  ctx.fillText(preview, x + 72, y + 56);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '13px sans-serif';
  ctx.fillText(time, w - 32, y + 30);

  // Avatar circle
  ctx.beginPath();
  ctx.arc(x + 44, y + 36, 20, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.degen;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lineCount = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      if (lineCount >= maxLines - 1) {
        ctx.fillText(`${line}...`, x, y + lineCount * lineHeight);
        return;
      }
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y + lineCount * lineHeight);
}

// ── Page Renderers ─────────────────────────────────────────────

function renderFeed(ctx, w, h) {
  drawStatusBar(ctx, w);

  // Feed header
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Your Feed', 24, 110);

  // Posts
  drawMockPost(ctx, 0, 140, w, 'nostr', 'alex', 'gm degenfrens ☕ just aggregated my Nostr and Farcaster feeds — this is the future of social', '2m');
  drawMockPost(ctx, 0, 320, w, 'farcaster', 'crypto.eth', 'Bullish on decentralized social. The protocol composability here is insane 🔥', '15m');
  drawMockPost(ctx, 0, 500, w, 'lens', 'degendad.lens', 'Just posted across 4 protocols with one click. DegenFeed is goated 🐐', '42m');
  drawMockPost(ctx, 0, 680, w, 'bluesky', 'satoshi fan', 'Cross-posting from Bluesky to Nostr works flawlessly. This aggregator is exactly what we needed.', '1h');

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↓ Pull to refresh', w / 2, h - 130);

  drawNavBar(ctx, w, h);
}

function renderPost(ctx, w, h) {
  drawStatusBar(ctx, w);

  // New Post header
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('New Post', 24, 110);

  // Avatar
  ctx.beginPath();
  ctx.arc(48, 170, 28, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.degen;
  ctx.fill();

  // Text input area
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, 16, 210, w - 32, 320, 16);
  ctx.fill();

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('What\'s happening in the degen world?', 36, 260);

  // Protocol toggles
  const protocols = [
    { name: 'Nostr', color: COLORS.nostr, active: true },
    { name: 'Farcaster', color: COLORS.farcaster, active: true },
    { name: 'Lens', color: COLORS.lens, active: true },
    { name: 'Bluesky', color: COLORS.bluesky, active: true },
    { name: 'Mastodon', color: COLORS.mastodon, active: false },
  ];

  let px = 36;
  for (const p of protocols) {
    ctx.fillStyle = p.active ? p.color : COLORS.surfaceLight;
    roundRect(ctx, px, 560, p.name.length * 14 + 32, 38, 19);
    ctx.fill();

    ctx.fillStyle = p.active ? '#000' : COLORS.textMuted;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, px + (p.name.length * 14 + 32) / 2, 586);
    px += p.name.length * 14 + 48;
  }

  // Post button
  ctx.fillStyle = COLORS.degen;
  roundRect(ctx, w - 160, h - 240, 128, 52, 26);
  ctx.fill();

  ctx.fillStyle = COLORS.bg;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Post', w - 96, h - 204);

  drawNavBar(ctx, w, h);
}

function renderDiscover(ctx, w, h) {
  drawStatusBar(ctx, w);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Discover', 24, 110);

  // Trending topics
  const topics = [
    { title: '#Bitcoin', subtitle: '12.4K posts · Trending', color: '#f7931a' },
    { title: '#Solana', subtitle: '8.2K posts · Ecosystem 🚀', color: '#9945ff' },
    { title: '#DeFi Summer 2.0', subtitle: '5.7K posts · 🔥 Hot', color: COLORS.degen },
    { title: '#NFTs', subtitle: '3.1K posts · Stable', color: '#ff6b9d' },
    { title: '#Web3 Social', subtitle: '2.8K posts · Rising', color: COLORS.lens },
    { title: '#Ethereum', subtitle: '6.4K posts · Layer 2', color: '#627eea' },
  ];

  let y = 160;
  for (const topic of topics) {
    drawMockDiscoverCard(ctx, 0, y, w, topic.title, topic.subtitle, topic.color);
    y += 116;
  }

  drawNavBar(ctx, w, h);
}

function renderProfile(ctx, w, h) {
  drawStatusBar(ctx, w);

  // Profile header
  ctx.beginPath();
  ctx.arc(w / 2, 180, 60, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.degen;
  ctx.fill();
  ctx.strokeStyle = COLORS.degen;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('degendad.eth', w / 2, 280);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '16px sans-serif';
  ctx.fillText('npub1...degen', w / 2, 310);

  // Stats
  const stats = [
    { label: 'Following', value: '342' },
    { label: 'Followers', value: '1.2K' },
    { label: 'Posts', value: '847' },
  ];

  const statW = w / stats.length;
  stats.forEach((s, i) => {
    const sx = statW * i + statW / 2;
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.value, sx, 370);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '16px sans-serif';
    ctx.fillText(s.label, sx, 396);
  });

  // Connected protocols
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Connected Protocols', 24, 450);

  const protos = [
    { name: 'Nostr', color: COLORS.nostr },
    { name: 'Farcaster', color: COLORS.farcaster },
    { name: 'Lens', color: COLORS.lens },
    { name: 'Bluesky', color: COLORS.bluesky },
  ];

  let px2 = 24;
  for (const p of protos) {
    ctx.fillStyle = p.color;
    roundRect(ctx, px2, 470, 100, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, px2 + 50, 494);
    px2 += 112;
  }

  // Recent posts header
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Recent Posts', 24, 550);

  // Post cards
  drawMockPost(ctx, 0, 570, w, 'nostr', 'degendad.eth', 'Testing cross-protocol posting from DegenFeed! This goes to Nostr, Farcaster, Lens, and Bluesky simultaneously.', '3h');
  drawMockPost(ctx, 0, 750, w, 'farcaster', 'degendad.eth', 'DegenFeed v1 is live on TestFlight! DM me for access 🚀', '5h');

  drawNavBar(ctx, w, h);
}

function renderMessages(ctx, w, h) {
  drawStatusBar(ctx, w);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Messages', 24, 110);

  const conversations = [
    { name: 'alex (Nostr)', preview: 'gm! Did you see the latest...', time: '2m' },
    { name: 'crypto.eth (Farcaster)', preview: 'The protocol aggregation is...', time: '15m' },
    { name: 'degendad.lens', preview: 'Just sent you the beta build', time: '1h' },
    { name: 'satoshi (Bluesky)', preview: 'Cross-posting is working great', time: '3h' },
    { name: 'vitalik (Nostr)', preview: 'Interesting take on decentralized...', time: '6h' },
    { name: 'jack (Farcaster)', preview: 'Let me know what you think', time: '1d' },
  ];

  let y = 150;
  for (const convo of conversations) {
    drawMockMessage(ctx, 0, y, w, convo.name, convo.preview, convo.time);
    y += 80;
  }

  drawNavBar(ctx, w, h);
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  const outDir = join(__dirname, 'rendered');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const renderers = {
    feed: renderFeed,
    post: renderPost,
    discover: renderDiscover,
    profile: renderProfile,
    messages: renderMessages,
  };

  for (const device of DEVICES) {
    const { id, width: w, height: h, label } = device;

    for (const page of PAGES) {
      // Skip iPad non-required pages
      if (id.startsWith('ipad') && !['feed', 'discover'].includes(page)) continue;

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      // Render page
      renderers[page](ctx, w, h);

      // Save
      const filename = `degenfeed-${page}-${id}.png`;
      const filepath = join(outDir, filename);
      const buffer = canvas.toBuffer('image/png');
      writeFileSync(filepath, buffer);
      console.log(`✅ Generated: ${filename}  (${label} - ${w}×${h})`);
    }
  }

  console.log('\n🎉 All screenshots generated!');
  console.log(`📁 Output directory: ${outDir}`);
}

try {
  main();
} catch (err) {
  if (err.message?.includes('registerFont') || err.message?.includes('canvas')) {
    console.error(`
❌ Canvas rendering failed. This requires the 'canvas' npm package.

Install it:
  pnpm add -D canvas

If native dependencies are missing on Linux:
  apt install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

On macOS (Xcode required):
  brew install pkg-config cairo pango libpng jpeg giflib librsvg

Then re-run: node generate-screenshots.mjs
`);
    process.exit(1);
  }
  throw err;
}

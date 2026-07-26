/**
 * @degenfeed/api-worker — Digest HTML Templates
 *
 * Rich HTML newsletter builder for digest delivery.
 */

import type { DigestResponse } from './types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a rich HTML newsletter with Web3-native voice, professional tone,
 * and proper source attribution.
 */
export function buildRichDigestHtml(digest: DigestResponse): string {
  const { subject, sections, featured, editorial, marketSummary, date, format } = digest;
  const isDark = true;

  const style = isDark
    ? {
        bg: '#0a0a0a',
        card: '#111827',
        text: '#e5e7eb',
        muted: '#9ca3af',
        accent: '#10b981',
        border: '#1f2937',
        heading: '#ffffff',
      }
    : {
        bg: '#ffffff',
        card: '#f9fafb',
        text: '#111827',
        muted: '#6b7280',
        accent: '#059669',
        border: '#e5e7eb',
        heading: '#111827',
      };

  const featuredHtml = featured
    ? `<div style="background:${style.card};border-radius:12px;overflow:hidden;margin-bottom:24px;border:1px solid ${style.border}">
      ${featured.image ? `<img src="${escapeHtml(featured.image)}" alt="" style="width:100%;max-height:300px;object-fit:cover"/>` : ''}
      <div style="padding:20px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="background:${style.accent};color:#000;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600">FEATURED</span>
          <span style="color:${style.muted};font-size:11px">${featured.author.displayName}</span>
        </div>
        <h2 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;color:${style.heading}">
          <a href="${escapeHtml(featured.url)}" style="color:${style.heading};text-decoration:none">${escapeHtml(featured.title)}</a>
        </h2>
        <p style="font-size:14px;color:${style.muted};line-height:1.6;margin:0">${escapeHtml(featured.excerpt)}</p>
      </div>
    </div>`
    : '';

  const marketHtml = marketSummary?.coins?.length
    ? `<div style="background:${style.card};border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid ${style.border}">
      <h3 style="margin:0 0 12px 0;font-size:14px;color:${style.heading}">💹 Market Summary</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="color:${style.muted};border-bottom:1px solid ${style.border}">
          <th style="text-align:left;padding:6px 8px">Asset</th>
          <th style="text-align:right;padding:6px 8px">Price</th>
          <th style="text-align:right;padding:6px 8px">24h</th>
        </tr></thead>
        <tbody>${marketSummary.coins
          .map((coin) => {
            const changeColor = coin.change24h >= 0 ? '#22c55e' : '#ef4444';
            const changeSign = coin.change24h >= 0 ? '+' : '';
            return `<tr style="border-bottom:1px solid ${style.border}">
            <td style="padding:6px 8px;color:${style.text}">${coin.symbol}</td>
            <td style="text-align:right;padding:6px 8px;color:${style.text}">$${coin.price.toLocaleString()}</td>
            <td style="text-align:right;padding:6px 8px;color:${changeColor}">${changeSign}${coin.change24h.toFixed(1)}%</td>
          </tr>`;
          })
          .join('')}</tbody>
      </table>
    </div>`
    : '';

  const sectionsHtml = sections
    .map((section) => {
      if (section.type === 'trending') {
        const chips = section.items
          .map(
            (item) =>
              `<span style="display:inline-block;background:${style.card};color:${style.accent};padding:4px 12px;border-radius:16px;font-size:11px;margin:3px;border:1px solid ${style.border}">#${escapeHtml(item.title)} <span style="color:${style.muted}">${item.excerpt}</span></span>`,
          )
          .join(' ');
        return chips
          ? `<div style="margin-bottom:24px"><h3 style="margin:0 0 12px 0;font-size:14px;color:${style.heading}">🔥 ${section.title}</h3><div>${chips}</div></div>`
          : '';
      }
      const items = section.items
        .map((item) => {
          const imgHtml = item.image
            ? `<img src="${escapeHtml(item.image)}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0"/>`
            : '';
          const nicheTags = item.niches
            .slice(0, 3)
            .map(
              (n) =>
                `<span style="background:${style.accent}15;color:${style.accent};padding:1px 6px;border-radius:4px;font-size:10px;margin-right:4px">#${escapeHtml(n)}</span>`,
            )
            .join('');
          return `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid ${style.border}">
        ${imgHtml}
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:${style.muted};margin-bottom:2px">${escapeHtml(item.protocolEmoji)} ${escapeHtml(item.author.displayName)} · ${formatTime(item.createdAt)}</div>
          <h4 style="margin:0 0 4px 0;font-size:14px;line-height:1.3"><a href="${escapeHtml(item.url)}" style="color:${style.heading};text-decoration:none">${escapeHtml(item.title)}</a></h4>
          <p style="font-size:12px;color:${style.muted};line-height:1.5;margin:0 0 4px 0">${escapeHtml(item.excerpt)}</p>
          <div>${nicheTags}</div>
        </div>
      </div>`;
        })
        .join('\n');
      return items
        ? `<div style="margin-bottom:24px"><h3 style="margin:0 0 8px 0;font-size:16px;color:${style.heading}">${section.title}</h3>${items}</div>`
        : '';
    })
    .join('\n');

  const shareUrl =
    digest.shareUrl || `https://degenfeed.xyz/news/digest/${encodeURIComponent(date)}`;

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(subject)}</title></head>
<body style="background:${style.bg};color:${style.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:28px;margin-bottom:4px">◆</div>
    <h1 style="margin:0;font-size:22px;color:${style.accent};font-weight:700">DegenFeed ${format === 'daily-brief' ? 'Daily' : format === 'weekly-deep-dive' ? 'Weekly' : format === 'topic-digest' ? 'Topic Digest' : 'Protocol Report'}</h1>
    <p style="color:${style.muted};font-size:12px;margin:4px 0 0 0">${new Date(date).toDateString()}</p>
  </div>
  ${
    editorial
      ? `<div style="background:${style.card};border-radius:12px;padding:16px;margin-bottom:24px;border-left:3px solid ${style.accent}">
    <p style="font-size:14px;line-height:1.6;margin:0 0 8px 0;color:${style.text}">${escapeHtml(editorial.opening)}</p>
    ${editorial.marketOverview ? `<p style="font-size:13px;line-height:1.5;margin:0 0 8px 0;color:${style.muted}">${escapeHtml(editorial.marketOverview)}</p>` : ''}
    <p style="font-size:13px;line-height:1.5;margin:0;color:${style.muted}">${escapeHtml(editorial.closing)}</p>
  </div>`
      : ''
  }
  ${featuredHtml}
  ${marketHtml}
  ${sectionsHtml}
  <div style="text-align:center;margin:24px 0;padding:16px;background:${style.card};border-radius:12px;border:1px solid ${style.border}">
    <p style="font-size:12px;color:${style.muted};margin:0 0 8px 0">Share this digest</p>
    <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(subject)}&url=${encodeURIComponent(shareUrl)}" style="display:inline-block;background:#1d9bf0;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;text-decoration:none;margin:0 4px">𝕏 Twitter</a>
    <a href="https://warpcast.com/~/compose?text=${encodeURIComponent(`${subject} ${shareUrl}`)}" style="display:inline-block;background:#8a63d2;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;text-decoration:none;margin:0 4px">🟣 Farcaster</a>
    <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:${style.accent};color:#000;padding:6px 12px;border-radius:6px;font-size:12px;text-decoration:none;margin:0 4px">◆ Open in DegenFeed</a>
  </div>
  <hr style="border:0;border-top:1px solid ${style.border};margin:24px 0"/>
  <p style="font-size:11px;color:${style.muted};text-align:center;margin:0">
    You're receiving this because you subscribed at <a href="https://degenfeed.xyz/newsletter" style="color:${style.accent}">degenfeed.xyz/newsletter</a>.<br/>
    <a href="https://degenfeed.xyz/api/news/digest/unsubscribe?email={{EMAIL}}" style="color:${style.muted}">Unsubscribe</a> ·
    <a href="https://degenfeed.xyz/api/feed/rss.xml" style="color:${style.muted}">RSS Feed</a> ·
    <a href="https://degenfeed.xyz" style="color:${style.muted}">Open App</a>
  </p>
</div></body></html>`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

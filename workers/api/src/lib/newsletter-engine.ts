/**
 * @degenfeed/api-worker — Newsletter Engine
 *
 * Handles free and paid newsletter distribution via email providers
 * (Mailgun / SendGrid), message template rendering, and cross-posting
 * summaries to all social protocols.
 */

import { GhostBridge, type GhostPost } from '@degenfeed/ghost-bridge';
import type { Protocol } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────

export interface NewsletterConfig {
  ghostUrl: string;
  ghostAdminKey: string;
  ghostContentKey?: string;
  emailApiKey: string;
  emailProvider: 'sendgrid' | 'mailgun';
  emailFrom: string;
  emailFromName: string;
  /** KV namespace for subscriber management */
  subscriberStore?: KVNamespace;
  /** KV namespace for sent newsletter tracking */
  sentStore?: KVNamespace;
}

interface Subscriber {
  email: string;
  name: string;
  tier: 'free' | 'paid';
  subscribedAt: string;
  active: boolean;
  unsubscribedAt?: string;
}

// ─── HTML Email Templates ─────────────────────────────────────────

const EMAIL_STYLES = `
<style>
  body { background: #0a0a0a; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px; }
  .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #1f2937; }
  .logo { font-size: 24px; color: #00ff41; font-weight: 900; letter-spacing: -1px; }
  .content { padding: 24px 0; line-height: 1.6; }
  .post-card { background: #111827; border-radius: 12px; padding: 20px; margin: 16px 0; border: 1px solid #1f2937; }
  .post-title { color: #f9fafb; font-size: 20px; margin: 0 0 8px 0; }
  .post-excerpt { color: #9ca3af; font-size: 14px; line-height: 1.5; }
  .post-meta { color: #6b7280; font-size: 12px; margin-top: 8px; }
  .btn { display: inline-block; background: #00ff41; color: #000; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 12px; }
  .footer { text-align: center; padding: 24px 0; border-top: 1px solid #1f2937; font-size: 12px; color: #6b7280; }
  .tip-section { background: #111827; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #1f2937; }
  .protocol-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin: 2px; }
</style>`;

function buildWelcomeEmail(name: string, tier: 'free' | 'paid'): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/>${EMAIL_STYLES}</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">◆ DegenFeed</div>
    </div>
    <div class="content">
      <h1 style="color: #f9fafb; font-size: 24px;">Welcome${name ? `, ${name}` : ''}!</h1>
      <p style="color: #9ca3af; font-size: 15px; line-height: 1.6;">
        ${
          tier === 'paid'
            ? "You're now subscribed to the <strong style='color:#00ff41'>DegenFeed Premium Newsletter</strong> — paid subscribers get exclusive deep dives, early access to alpha, and token-gated content."
            : "You're now subscribed to the <strong style='color:#00ff41'>DegenFeed Newsletter</strong> — free weekly digests of the best in crypto, web3, AI, and decentralized tech."
        }
      </p>
      ${
        tier === 'paid'
          ? '<p style="color: #9ca3af; font-size: 14px;">Your first premium issue will arrive soon. In the meantime, explore exclusive content at <a href="https://degenfeed.xyz/articles" style="color: #00ff41;">degenfeed.xyz/articles</a>.</p>'
          : '<p style="color: #9ca3af; font-size: 14px;">Your first issue arrives soon. Browse the latest articles at <a href="https://degenfeed.xyz/articles" style="color: #00ff41;">degenfeed.xyz/articles</a>.</p>'
      }
      <a class="btn" href="https://degenfeed.xyz/articles">Browse Articles</a>
    </div>
    <div class="footer">
      <p>You're receiving this because you subscribed at degenfeed.xyz</p>
      <p><a href="https://degenfeed.xyz/api/ghost/unsubscribe?email={{email}}" style="color: #6b7280;">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`;
}

function buildArticleEmail(post: GhostPost, tier: 'free' | 'paid'): string {
  const isGated = tier === 'free' && post.subscriberOnly;
  const contentPreview = isGated ? `${post.excerpt.slice(0, 300)}...` : post.html.slice(0, 2000);

  return `<!doctype html>
<html><head><meta charset="utf-8"/>${EMAIL_STYLES}</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">◆ DegenFeed</div>
      <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0 0;">
        ${tier === 'paid' ? 'Premium Edition' : 'Free Edition'} · ${new Date(post.publishedAt).toDateString()}
      </p>
    </div>
    <div class="content">
      <div class="post-card">
        <p style="color: #00ff41; font-size: 12px; margin: 0 0 8px 0;">
          ${post.readingTime} min read
          ${post.subscriberOnly ? ' · 🔒 Subscribers Only' : ''}
        </p>
        <h2 class="post-title">${post.title}</h2>
        ${post.featuredImage ? `<img src="${post.featuredImage}" alt="" style="width:100%;border-radius:8px;margin:12px 0;max-height:300px;object-fit:cover;"/>` : ''}
        <div class="post-excerpt">${contentPreview}</div>
        ${
          isGated
            ? `<div class="tip-section"><p style="color: #f5a623; font-size: 13px;">✦ This article is for paid subscribers only</p><p style="color: #9ca3af; font-size: 13px;">Upgrade to Premium to read the full article.</p><a class="btn" href="https://degenfeed.xyz/premium">Upgrade to Premium</a></div>`
            : `<a class="btn" href="https://degenfeed.xyz/articles/${post.slug}">Read Full Article</a>`
        }
      </div>

      ${
        post.tipAddresses
          ? `<div class="tip-section">
            <p style="color: #e5e7eb; font-size: 14px; margin: 0 0 8px 0;">✦ Support this author</p>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Send tips via ETH, SOL, BTC, or Lightning</p>
           </div>`
          : ''
      }

      <div style="margin-top: 24px;">
        <p style="color: #6b7280; font-size: 12px;">Posted by ${post.authors.map((a) => a.name).join(', ')}</p>
        <p style="color: #6b7280; font-size: 12px;">
          Tags: ${post.tags.map((t) => `<span class="protocol-badge" style="background:#1f2937;color:#9ca3af;">#${t}</span>`).join(' ')}
        </p>
      </div>
    </div>
    <div class="footer">
      <p>You're receiving this because you're subscribed to the ${tier} newsletter.</p>
      <p>
        <a href="https://degenfeed.xyz/articles" style="color: #00ff41;">Browse</a> ·
        <a href="{{unsubscribe_url}}" style="color: #6b7280;">Unsubscribe</a> ·
        <a href="https://degenfeed.xyz/premium" style="color: #00ff41;">Upgrade</a>
      </p>
    </div>
  </div>
</body></html>`;
}

// ─── Newsletter Engine ──────────────────────────────────────────────

export class NewsletterEngine {
  private config: NewsletterConfig;
  private bridge: GhostBridge;

  constructor(config: NewsletterConfig) {
    this.config = config;
    this.bridge = new GhostBridge({
      ghostUrl: config.ghostUrl,
      ghostAdminKey: config.ghostAdminKey,
      ghostContentKey: config.ghostContentKey,
    });
  }

  // ─── Email Sending ──────────────────────────────────────────────

  private async sendEmail(
    to: Array<{ email: string; name?: string }>,
    subject: string,
    html: string,
  ): Promise<{ sent: number; failed: number }> {
    if (to.length === 0) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;

    // SendGrid API
    if (this.config.emailProvider === 'sendgrid') {
      const payload = {
        personalizations: to.map((t) => ({
          to: [{ email: t.email, name: t.name || '' }],
          substitutions: {
            email: t.email,
            unsubscribe_url: `https://degenfeed.xyz/api/ghost/unsubscribe?email=${encodeURIComponent(t.email)}`,
          },
        })),
        from: { email: this.config.emailFrom, name: this.config.emailFromName },
        subject,
        content: [{ type: 'text/html', value: html }],
      };

      try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.emailApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          sent = to.length;
        } else {
          failed = to.length;
        }
      } catch {
        failed = to.length;
      }
    }

    // Mailgun API
    if (this.config.emailProvider === 'mailgun') {
      const domain = this.config.emailFrom.split('@')[1] || 'degenfeed.xyz';
      const mgUrl = `https://api.mailgun.net/v3/${domain}/messages`;

      try {
        const formData = new URLSearchParams();
        formData.set('from', `${this.config.emailFromName} <${this.config.emailFrom}>`);
        formData.set('subject', subject);
        formData.set('html', html);
        formData.set('o:tracking', 'yes');
        formData.set('o:tracking-clicks', 'yes');
        formData.set('o:tracking-opens', 'yes');

        for (const t of to) {
          formData.append('to', t.email);
        }

        const res = await fetch(mgUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`api:${this.config.emailApiKey}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });
        if (res.ok) {
          sent = to.length;
        } else {
          failed = to.length;
        }
      } catch {
        failed = to.length;
      }
    }

    // Fallback: log instead of send
    if (!['sendgrid', 'mailgun'].includes(this.config.emailProvider)) {
      console.log(`[NewsletterEngine] Would send email to ${to.length} recipients: ${subject}`);
      sent = to.length;
    }

    return { sent, failed };
  }

  // ─── Get Subscribers by Tier ────────────────────────────────────

  private async getSubscribers(tier?: 'free' | 'paid'): Promise<Subscriber[]> {
    if (!this.config.subscriberStore) return [];

    const subscribers: Subscriber[] = [];
    const list = await this.config.subscriberStore.list({ prefix: 'sub:' });

    for (const key of list.keys) {
      const raw = await this.config.subscriberStore.get(key.name);
      if (raw) {
        const sub = JSON.parse(raw) as Subscriber;
        if (sub.active && (!tier || sub.tier === tier)) {
          subscribers.push(sub);
        }
      }
    }

    return subscribers;
  }

  // ─── Send Free Newsletter ───────────────────────────────────────

  async sendFreeNewsletter(postId: string): Promise<{ sent: number; failed: number }> {
    const post = await this.bridge.getPost(postId);
    const subscribers = await this.getSubscribers('free');

    const html = buildArticleEmail(post, 'free');
    const subject = `📫 ${post.title} — DegenFeed Free Edition`;

    const result = await this.sendEmail(
      subscribers.map((s) => ({ email: s.email, name: s.name })),
      subject,
      html,
    );

    // Track sent
    if (this.config.sentStore) {
      const key = `sent:free:${postId}:${Date.now()}`;
      await this.config.sentStore.put(
        key,
        JSON.stringify({
          postId,
          tier: 'free',
          recipients: result.sent,
          sentAt: new Date().toISOString(),
        }),
      );
    }

    return result;
  }

  // ─── Send Paid Newsletter ───────────────────────────────────────

  async sendPaidNewsletter(postId: string): Promise<{ sent: number; failed: number }> {
    const post = await this.bridge.getPost(postId);
    const subscribers = await this.getSubscribers('paid');

    const html = buildArticleEmail(post, 'paid');
    const subject = `🔒 ${post.title} — DegenFeed Premium`;

    const result = await this.sendEmail(
      subscribers.map((s) => ({ email: s.email, name: s.name })),
      subject,
      html,
    );

    // Track sent
    if (this.config.sentStore) {
      const key = `sent:paid:${postId}:${Date.now()}`;
      await this.config.sentStore.put(
        key,
        JSON.stringify({
          postId,
          tier: 'paid',
          recipients: result.sent,
          sentAt: new Date().toISOString(),
        }),
      );
    }

    return result;
  }

  // ─── Email Distribution (Unified) ───────────────────────────────

  async sendEmailTo(
    toAddresses: string[],
    post: GhostPost,
  ): Promise<{ sent: number; failed: number }> {
    const html = buildArticleEmail(post, 'free');
    const subject = `📫 ${post.title} — DegenFeed`;

    return this.sendEmail(
      toAddresses.map((email) => ({ email })),
      subject,
      html,
    );
  }

  // ─── Cross-post article summary to all protocols ────────────────

  async announceToProtocols(post: GhostPost): Promise<void> {
    const protocols: Protocol[] = ['nostr', 'farcaster', 'bluesky', 'lens', 'mastodon'];
    const _summary = post.excerpt || post.html.replace(/<[^>]+>/g, '').slice(0, 280);

    console.log(
      `[NewsletterEngine] Announcing "${post.title}" to protocols: ${protocols.join(', ')}`,
    );

    try {
      await this.bridge.crossPublish(post.id, protocols as any);
    } catch (err) {
      console.error('[NewsletterEngine] Cross-publish failed:', err);
    }
  }

  // ─── Send Welcome Email ─────────────────────────────────────────

  async sendWelcome(email: string, name: string, tier: 'free' | 'paid'): Promise<boolean> {
    const html = buildWelcomeEmail(name, tier);
    const subject =
      tier === 'paid' ? 'Welcome to DegenFeed Premium! 🚀' : 'Welcome to DegenFeed Newsletter 📫';

    const result = await this.sendEmail([{ email, name }], subject, html);
    return result.sent > 0;
  }
}

/**
 * Newsletter email template — full article newsletter sent to subscribers.
 */

import type { NewsletterTemplateParams } from './types';
import { emailDocument } from './types';

export function renderNewsletterHtml(params: NewsletterTemplateParams): string {
  const {
    title,
    authorName,
    content,
    unsubscribeUrl,
    trackingPixelUrl,
    subject,
    preheader,
    logoUrl,
  } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="DegenFeed" width="32" height="32" style="display:block;border:0;outline:none;" />`
    : '<span style="color:#10b981;font-size:24px;font-weight:700;">◆</span>';

  const body = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding:0 0 24px 0;">
        <a href="https://degenfeed.xyz" style="text-decoration:none;color:#e5e7eb;">
          ${logoHtml}
        </a>
      </td>
    </tr>

    <!-- Subject Preheader -->
    <tr>
      <td style="padding:0 0 8px 0;">
        <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">
          ${subject}
        </p>
      </td>
    </tr>

    <!-- Main Card -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;padding:0;">
        <div style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:32px 28px;">
          <!-- Title -->
          <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.02em;">
            ${title}
          </h1>
          <p style="margin:0 0 24px 0;font-size:13px;color:#9ca3af;">
            By ${authorName}
          </p>

          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr><td style="border-bottom:1px solid #1f2937;"></td></tr>
          </table>

          <!-- Content -->
          <div style="font-size:15px;color:#d1d5db;line-height:1.7;">
            ${content}
          </div>

          <!-- Tracking Pixel -->
          <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;width:1px;height:1px;margin-top:24px;" />
        </div>
      </td>
    </tr>

    <!-- Spacer -->
    <tr><td style="height:24px;"></td></tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:24px 28px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;line-height:1.5;">
          You received this newsletter because you're subscribed to ${authorName} on DegenFeed.
        </p>
        <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;line-height:1.5;">
          <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          &nbsp;·&nbsp;
          <a href="https://degenfeed.xyz/newsletter/preferences" style="color:#6b7280;text-decoration:underline;">Manage Preferences</a>
        </p>
        <p style="margin:0;font-size:11px;color:#4b5563;">
          Powered by <a href="https://degenfeed.xyz" style="color:#10b981;text-decoration:none;">DegenFeed</a>
        </p>
      </td>
    </tr>
  `;

  return emailDocument(body, preheader || subject);
}


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
    <!-- Header / Logo -->
    <tr>
      <td align="center" style="padding:0 0 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding:0;">
              <a href="https://degenfeed.xyz" style="text-decoration:none;color:#e5e7eb;">
                ${logoHtml}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Card -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;padding:0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="#" style="height:100%;v-text-anchor:middle;width:600px;" arcsize="4%" strokecolor="#1f2937" fillcolor="#111827">
        <w:anchorlock/>
        <center style="color:#e5e7eb;text-decoration:none;">
        <![endif]-->
        <div style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:32px 28px;">
          <!-- Subject as preheader text (hidden) -->
          <div style="display:none;font-size:1px;color:#111827;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
            ${subject}
          </div>

          <!-- Title -->
          <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.02em;">
            ${title}
          </h1>

          <!-- Author -->
          <p style="margin:0 0 24px 0;font-size:14px;color:#9ca3af;">
            By ${authorName} · <a href="https://degenfeed.xyz" style="color:#10b981;text-decoration:none;">DegenFeed</a>
          </p>

          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td style="border-bottom:1px solid #1f2937;"></td>
            </tr>
          </table>

          <!-- Content -->
          <div style="font-size:16px;line-height:1.7;color:#d1d5db;">
            ${content}
          </div>

          <!-- Tracking Pixel -->
          <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;width:1px;height:1px;" />
        </div>
        <!--[if mso]></center></v:roundrect><![endif]-->
      </td>
    </tr>

    <!-- Spacer -->
    <tr><td style="height:24px;"></td></tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:24px 28px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;line-height:1.5;">
          You received this because you subscribed to <strong style="color:#9ca3af;">${authorName}</strong> on DegenFeed.
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

  return emailDocument(body, preheader ?? `New article from ${authorName}: ${title}`);
}

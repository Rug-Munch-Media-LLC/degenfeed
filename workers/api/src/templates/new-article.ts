/**
 * New article alert template — sent when a creator publishes a new article.
 */

import type { NewArticleTemplateParams } from './types';
import { emailDocument } from './types';

export function renderNewArticleHtml(params: NewArticleTemplateParams): string {
  const {
    authorName,
    title,
    excerpt,
    articleUrl,
    unsubscribeUrl,
    trackingPixelUrl,
    articleImageUrl,
    logoUrl,
  } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="DegenFeed" width="32" height="32" style="display:block;border:0;outline:none;" />`
    : '<span style="color:#10b981;font-size:24px;font-weight:700;">◆</span>';

  const imageHtml = articleImageUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td style="border-radius:8px;overflow:hidden;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${articleUrl}" style="height:auto;v-text-anchor:middle;width:600px;" strokecolor="#1f2937" fillcolor="#111827">
            <w:anchorlock/>
            <v:fill type="frame" src="${articleImageUrl}" />
            <v:roundrect arcsize="2%" strokecolor="#1f2937">
            <![endif]-->
            <a href="${articleUrl}" style="text-decoration:none;">
              <img src="${articleImageUrl}" alt="" width="100%" style="display:block;border:0;outline:none;border-radius:8px;max-height:320px;object-fit:cover;" />
            </a>
            <!--[if mso]></v:roundrect></v:fill></v:rect><![endif]-->
          </td>
        </tr>
      </table>`
    : '';

  const body = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding:0 0 24px 0;">
        <a href="https://degenfeed.xyz" style="text-decoration:none;color:#e5e7eb;">
          ${logoHtml}
        </a>
      </td>
    </tr>

    <!-- Main Card -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;padding:0;">
        <div style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:28px;">
          <!-- Author label -->
          <p style="margin:0 0 12px 0;font-size:12px;color:#10b981;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
            New Article from ${authorName}
          </p>

          <!-- Image -->
          ${imageHtml}

          <!-- Title -->
          <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.01em;">
            <a href="${articleUrl}" style="color:#ffffff;text-decoration:none;">
              ${title}
            </a>
          </h2>

          <!-- Excerpt -->
          <p style="margin:0 0 24px 0;font-size:14px;color:#9ca3af;line-height:1.6;">
            ${excerpt}
          </p>

          <!-- Read More Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td align="center" style="border-radius:8px;background-color:#10b981;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${articleUrl}" style="height:44px;v-text-anchor:middle;width:180px;" arcsize="18%" strokecolor="#10b981" fillcolor="#10b981">
                <w:anchorlock/>
                <center style="color:#0a0a0a;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;">
                <![endif]-->
                <a href="${articleUrl}" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:8px;background-color:#10b981;">
                  Read Full Article
                </a>
                <!--[if mso]></center></v:roundrect><![endif]-->
              </td>
            </tr>
          </table>

          <!-- Tracking Pixel -->
          <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;width:1px;height:1px;margin-top:16px;" />
        </div>
      </td>
    </tr>

    <!-- Spacer -->
    <tr><td style="height:24px;"></td></tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:24px 28px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;line-height:1.5;">
          You received this because you're subscribed to ${authorName} on DegenFeed.
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

  return emailDocument(body, `${authorName} published: ${title}`);
}

/**
 * Welcome email template — sent when a user subscribes to a creator.
 */

import type { WelcomeTemplateParams } from './types';
import { emailDocument } from './types';

export function renderWelcomeHtml(params: WelcomeTemplateParams): string {
  const { creatorName, unsubscribeUrl, trackingPixelUrl, creatorProfileUrl, logoUrl } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="DegenFeed" width="32" height="32" style="display:block;border:0;outline:none;" />`
    : '<span style="color:#10b981;font-size:24px;font-weight:700;">◆</span>';

  const profileUrl = creatorProfileUrl ?? `https://degenfeed.xyz/profile/${encodeURIComponent(creatorName)}`;

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
        <div style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:40px 28px;text-align:center;">
          <!-- Checkmark -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:20px;">
            <tr>
              <td align="center" style="width:64px;height:64px;border-radius:32px;background-color:#10b9811a;">
                <span style="display:inline-block;font-size:28px;line-height:64px;color:#10b981;">✓</span>
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">
            Welcome to ${creatorName}
          </h1>
          <p style="margin:0 0 24px 0;font-size:15px;color:#9ca3af;line-height:1.6;">
            You're now subscribed to <strong style="color:#e5e7eb;">${creatorName}</strong> on DegenFeed.
            You'll receive the latest articles, updates, and exclusive content delivered directly to your inbox.
          </p>

          <!-- CTA Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td align="center" style="border-radius:8px;background-color:#10b981;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${profileUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" strokecolor="#10b981" fillcolor="#10b981">
                <w:anchorlock/>
                <center style="color:#0a0a0a;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;">
                <![endif]-->
                <a href="${profileUrl}" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:8px;background-color:#10b981;">
                  View Creator Profile
                </a>
                <!--[if mso]></center></v:roundrect><![endif]-->
              </td>
            </tr>
          </table>

          <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;width:1px;height:1px;margin-top:20px;" />
        </div>
      </td>
    </tr>

    <!-- Spacer -->
    <tr><td style="height:24px;"></td></tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:24px 28px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;line-height:1.5;">
          You're receiving this because you subscribed to ${creatorName} on DegenFeed.
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

  return emailDocument(body, `Welcome to ${creatorName} on DegenFeed!`);
}

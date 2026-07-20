/**
 * Payment receipt template — sent on successful paid subscription.
 */

import type { ReceiptTemplateParams } from './types';
import { emailDocument } from './types';

export function renderReceiptHtml(params: ReceiptTemplateParams): string {
  const {
    creatorName,
    amount,
    currency = 'USD',
    planName,
    billingDate,
    nextBillingDate,
    receiptUrl,
    logoUrl,
  } = params;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);

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

    <!-- Main Card -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;padding:0;">
        <div style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:32px 28px;">
          <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
            Payment Receipt
          </h1>
          <p style="margin:0 0 24px 0;font-size:14px;color:#9ca3af;text-align:center;">
            ${creatorName} · ${planName}
          </p>

          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr><td style="border-bottom:1px solid #1f2937;"></td></tr>
          </table>

          <!-- Amount -->
          <p style="margin:0 0 24px 0;font-size:36px;font-weight:700;color:#10b981;text-align:center;letter-spacing:-0.03em;">
            ${formattedAmount}
          </p>

          <!-- Details Table -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#9ca3af;">Plan</td>
              <td style="padding:8px 0;font-size:13px;color:#e5e7eb;text-align:right;">${planName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#9ca3af;border-top:1px solid #1f2937;">Billing Date</td>
              <td style="padding:8px 0;font-size:13px;color:#e5e7eb;text-align:right;border-top:1px solid #1f2937;">${billingDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#9ca3af;border-top:1px solid #1f2937;">Next Billing</td>
              <td style="padding:8px 0;font-size:13px;color:#e5e7eb;text-align:right;border-top:1px solid #1f2937;">${nextBillingDate}</td>
            </tr>
          </table>

          ${receiptUrl ? `
          <!-- View Receipt Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td align="center" style="border-radius:8px;background-color:#10b981;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${receiptUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" strokecolor="#10b981" fillcolor="#10b981">
                <w:anchorlock/>
                <center style="color:#0a0a0a;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;">
                <![endif]-->
                <a href="${receiptUrl}" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:8px;background-color:#10b981;">
                  View Full Receipt
                </a>
                <!--[if mso]></center></v:roundrect><![endif]-->
              </td>
            </tr>
          </table>
          ` : ''}
        </div>
      </td>
    </tr>

    <!-- Spacer -->
    <tr><td style="height:24px;"></td></tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#111827;border-radius:12px;border:1px solid #1f2937;padding:24px 28px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;">
          This is a receipt for your subscription to ${creatorName} on DegenFeed.
          <br/>
          <a href="https://degenfeed.xyz/support" style="color:#6b7280;text-decoration:underline;">Contact Support</a>
          &nbsp;·&nbsp;
          <a href="https://degenfeed.xyz" style="color:#10b981;text-decoration:none;">DegenFeed</a>
        </p>
      </td>
    </tr>
  `;

  return emailDocument(body, `Receipt: ${planName} from ${creatorName}`);
}

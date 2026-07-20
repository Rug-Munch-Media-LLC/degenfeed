/**
 * Email template parameter types for DegenFeed newsletter system.
 */

export interface NewsletterTemplateParams {
  title: string;
  authorName: string;
  content: string;
  unsubscribeUrl: string;
  trackingPixelUrl: string;
  subject: string;
  preheader?: string;
  logoUrl?: string;
}

export interface WelcomeTemplateParams {
  creatorName: string;
  unsubscribeUrl: string;
  trackingPixelUrl: string;
  creatorProfileUrl?: string;
  logoUrl?: string;
}

export interface ReceiptTemplateParams {
  creatorName: string;
  amount: number;
  currency?: string;
  planName: string;
  billingDate: string;
  nextBillingDate: string;
  receiptUrl?: string;
  logoUrl?: string;
}

export interface NewArticleTemplateParams {
  authorName: string;
  title: string;
  excerpt: string;
  articleUrl: string;
  unsubscribeUrl: string;
  trackingPixelUrl: string;
  articleImageUrl?: string;
  logoUrl?: string;
}

/**
 * Wraps an HTML body in a full email document with shared styles.
 */
export function emailDocument(
  bodyHtml: string,
  preheader?: string,
): string {
  const preheaderHtml = preheader
    ? `<!--[if !mso]><!-- -->
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${preheader}
    </div>
    <!--<![endif]-->`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
  <![endif]-->
  ${preheaderHtml}
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          ${bodyHtml}
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

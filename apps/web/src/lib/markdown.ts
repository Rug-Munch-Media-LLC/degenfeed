/**
 * Lightweight Markdown subset renderer for user bios.
 *
 * Supports: **bold**, *italic*, `inline code`, [label](url), and line breaks.
 * Output is an HTML string — always run through `sanitizeHtml` (DOMPurify)
 * before rendering with dangerouslySetInnerHTML.
 *
 * Links are validated to http/https only to avoid javascript: / data: XSS.
 */

const URL_RE = /^(https?:\/\/)[^\s<>"']+$/i;

export function isValidHttpUrl(url: string): boolean {
  return URL_RE.test(url);
}

/**
 * Render a safe Markdown subset to HTML.
 * @param md Markdown source (plain text)
 * @returns HTML string (must be sanitized before injection)
 */
export function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = escapeHtml(md);

  // Inline code (`code`) — escape before other transformations
  html = html.replace(/`([^`\n]+)`/g, (_m, code: string) => `<code>${code}</code>`);

  // Links [label](url) — only http/https allowed
  html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) return `[${label}]`;
    return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });

  // Bold **text** (not spanning newlines)
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Line breaks: double newline → paragraph, single newline → <br>
  const paragraphs = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 0) {
    html = paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('\n');
  } else {
    html = html.replace(/\n/g, '<br />');
  }

  return html;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

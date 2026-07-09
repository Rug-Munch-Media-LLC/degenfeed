'use client';

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'a',
  'b',
  'i',
  'em',
  'strong',
  'br',
  'p',
  'span',
  'div',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'video',
  'audio',
  'source',
];

const ALLOWED_ATTR = [
  'href',
  'title',
  'alt',
  'src',
  'class',
  'id',
  'target',
  'rel',
  'width',
  'height',
];

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
  });
}

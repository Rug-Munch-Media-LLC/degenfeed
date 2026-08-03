import { describe, expect, it } from 'vitest';
import { isValidHttpUrl, renderMarkdown } from './markdown';

describe('isValidHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
    expect(isValidHttpUrl('http://example.com/path')).toBe(true);
  });

  it('rejects non-http protocols and garbage', () => {
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('data:text/html,<script>')).toBe(false);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('not a url')).toBe(false);
  });
});

describe('renderMarkdown', () => {
  it('renders bold, italic and inline code', () => {
    const html = renderMarkdown('**bold** and *italic* and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders safe links with target and rel', () => {
    const html = renderMarkdown('[site](https://example.com)');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a>',
    );
  });

  it('keeps unsafe links as plain text', () => {
    const html = renderMarkdown('[bad](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('[bad]');
  });

  it('escapes HTML in the source', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converts double newlines to paragraphs', () => {
    const html = renderMarkdown('line one\n\nline two');
    expect(html).toContain('<p>line one</p>');
    expect(html).toContain('<p>line two</p>');
  });

  it('renders single newlines as line breaks', () => {
    const html = renderMarkdown('a\nb');
    expect(html).toContain('<br />');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});

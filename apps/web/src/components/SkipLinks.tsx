'use client';

/**
 * SkipLinks — Keyboard-accessible skip navigation links.
 *
 * Placed as the very first focusable elements in the DOM so that keyboard
 * and screen-reader users can jump directly to the main content regions.
 *
 * Each link is visually hidden until focused (the `.skip-link` CSS pattern),
 * then becomes fully visible with high contrast and the DegenFeed accent color.
 */
export function SkipLinks() {
  return (
    <nav aria-label="Skip to content" className="skip-links-group">
      <a className="skip-link" href="#main" id="skip-to-content">
        Skip to content
      </a>
      <a className="skip-link" href="#main-nav" id="skip-to-navigation">
        Skip to navigation
      </a>
      <a className="skip-link" href="#search-input" id="skip-to-search">
        Skip to search
      </a>
      <a className="skip-link" href="#footer" id="skip-to-footer">
        Skip to footer
      </a>
    </nav>
  );
}

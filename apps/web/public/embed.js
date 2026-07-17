/**
 * DegenFeed Embed — Standalone embed script for external sites.
 *
 * Load this script on any page to dynamically render DegenFeed post embeds.
 * Finds all <blockquote class="degenfeed-post"> elements and hydrates them
 * with full post data from the DegenFeed API.
 *
 * Usage:
 *   <blockquote class="degenfeed-post" data-post-uri="df://farcaster:0xabc123">
 *     <p>Post preview...</p>
 *     <footer>— <cite><a href="...">@author on DegenFeed</a></cite></footer>
 *   </blockquote>
 *   <script async src="https://app.degenfeed.xyz/embed.js"></script>
 *
 * Dark mode support via prefers-color-scheme.
 * Responsive — works on any width down to 320px.
 *
 * @license MIT
 * @version 1.0.0
 */
(function () {
  'use strict';

  var API_BASE = 'https://app.degenfeed.xyz';
  var STYLES_ID = 'df-embed-styles';

  // ─── Styles ──────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLES_ID)) return;
    var css = document.createElement('style');
    css.id = STYLES_ID;
    css.textContent =
      '/* DegenFeed Embed v1.0 */\n' +
      '.degenfeed-post {\n' +
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;\n' +
      '  max-width: 550px !important;\n' +
      '  margin: 16px auto !important;\n' +
      '  padding: 16px 20px !important;\n' +
      '  border: 1px solid #e5e7eb !important;\n' +
      '  border-radius: 12px !important;\n' +
      '  background: #ffffff !important;\n' +
      '  color: #111827 !important;\n' +
      '  font-size: 15px !important;\n' +
      '  line-height: 1.5 !important;\n' +
      '  box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;\n' +
      '  transition: box-shadow 0.15s ease !important;\n' +
      '  box-sizing: border-box !important;\n' +
      '  overflow: hidden !important;\n' +
      '}\n' +
      '.degenfeed-post:hover {\n' +
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;\n' +
      '}\n' +
      '.df-embed-row {\n' +
      '  display: flex !important;\n' +
      '  align-items: flex-start !important;\n' +
      '  gap: 12px !important;\n' +
      '}\n' +
      '.df-embed-avatar-wrap {\n' +
      '  flex-shrink: 0 !important;\n' +
      '}\n' +
      '.df-embed-avatar {\n' +
      '  width: 40px !important;\n' +
      '  height: 40px !important;\n' +
      '  border-radius: 50% !important;\n' +
      '  object-fit: cover !important;\n' +
      '  background: #f3f4f6 !important;\n' +
      '  display: block !important;\n' +
      '}\n' +
      '.df-embed-body {\n' +
      '  flex: 1 !important;\n' +
      '  min-width: 0 !important;\n' +
      '}\n' +
      '.df-embed-name-row {\n' +
      '  display: flex !important;\n' +
      '  align-items: center !important;\n' +
      '  gap: 6px !important;\n' +
      '  margin-bottom: 2px !important;\n' +
      '}\n' +
      '.df-embed-name {\n' +
      '  font-weight: 600 !important;\n' +
      '  font-size: 14px !important;\n' +
      '  color: #111827 !important;\n' +
      '  white-space: nowrap !important;\n' +
      '  overflow: hidden !important;\n' +
      '  text-overflow: ellipsis !important;\n' +
      '}\n' +
      '.df-embed-badge {\n' +
      '  display: inline-block !important;\n' +
      '  padding: 1px 8px !important;\n' +
      '  border-radius: 999px !important;\n' +
      '  background: #05966915 !important;\n' +
      '  color: #059669 !important;\n' +
      '  font-size: 10px !important;\n' +
      '  font-weight: 600 !important;\n' +
      '  text-transform: uppercase !important;\n' +
      '  letter-spacing: 0.02em !important;\n' +
      '  line-height: 1.4 !important;\n' +
      '  white-space: nowrap !important;\n' +
      '}\n' +
      '.df-embed-handle {\n' +
      '  font-size: 12px !important;\n' +
      '  color: #6b7280 !important;\n' +
      '}\n' +
      '.df-embed-text {\n' +
      '  margin: 6px 0 0 !important;\n' +
      '  font-size: 15px !important;\n' +
      '  line-height: 1.5 !important;\n' +
      '  color: #1f2937 !important;\n' +
      '  white-space: pre-wrap !important;\n' +
      '  word-break: break-word !important;\n' +
      '}\n' +
      '.df-embed-footer {\n' +
      '  display: flex !important;\n' +
      '  flex-wrap: wrap !important;\n' +
      '  align-items: center !important;\n' +
      '  gap: 4px 12px !important;\n' +
      '  margin-top: 10px !important;\n' +
      '  padding-top: 10px !important;\n' +
      '  border-top: 1px solid #f3f4f6 !important;\n' +
      '  font-size: 12px !important;\n' +
      '  color: #6b7280 !important;\n' +
      '}\n' +
      '.df-embed-footer cite {\n' +
      '  font-style: normal !important;\n' +
      '}\n' +
      '.df-embed-footer a {\n' +
      '  color: #059669 !important;\n' +
      '  text-decoration: none !important;\n' +
      '  font-weight: 500 !important;\n' +
      '}\n' +
      '.df-embed-footer a:hover {\n' +
      '  text-decoration: underline !important;\n' +
      '}\n' +
      '.df-embed-image {\n' +
      '  margin-top: 8px !important;\n' +
      '  border-radius: 8px !important;\n' +
      '  max-height: 200px !important;\n' +
      '  overflow: hidden !important;\n' +
      '}\n' +
      '.df-embed-image img {\n' +
      '  width: 100% !important;\n' +
      '  height: auto !important;\n' +
      '  object-fit: cover !important;\n' +
      '  display: block !important;\n' +
      '}\n' +
      '.df-embed-loading {\n' +
      '  display: flex !important;\n' +
      '  align-items: center !important;\n' +
      '  justify-content: center !important;\n' +
      '  padding: 20px !important;\n' +
      '  color: #9ca3af !important;\n' +
      '  font-size: 13px !important;\n' +
      '  gap: 8px !important;\n' +
      '}\n' +
      '.df-embed-spinner {\n' +
      '  display: inline-block !important;\n' +
      '  width: 16px !important;\n' +
      '  height: 16px !important;\n' +
      '  border: 2px solid #e5e7eb !important;\n' +
      '  border-top-color: #059669 !important;\n' +
      '  border-radius: 50% !important;\n' +
      '  animation: df-spin 0.6s linear infinite !important;\n' +
      '}\n' +
      '@keyframes df-spin {\n' +
      '  to { transform: rotate(360deg) }\n' +
      '}\n' +
      '.df-embed-error {\n' +
      '  padding: 16px 20px !important;\n' +
      '  color: #ef4444 !important;\n' +
      '  font-size: 13px !important;\n' +
      '  text-align: center !important;\n' +
      '}\n' +
      '.df-embed-stats {\n' +
      '  display: flex !important;\n' +
      '  gap: 12px !important;\n' +
      '  font-size: 12px !important;\n' +
      '  color: #9ca3af !important;\n' +
      '}\n' +
      '.df-embed-stats span {\n' +
      '  display: inline-flex !important;\n' +
      '  align-items: center !important;\n' +
      '  gap: 2px !important;\n' +
      '}\n' +
      '.df-embed-view-link {\n' +
      '  display: inline-flex !important;\n' +
      '  align-items: center !important;\n' +
      '  gap: 4px !important;\n' +
      '  margin-top: 6px !important;\n' +
      '  font-size: 12px !important;\n' +
      '  color: #059669 !important;\n' +
      '  text-decoration: none !important;\n' +
      '}\n' +
      '.df-embed-view-link:hover {\n' +
      '  text-decoration: underline !important;\n' +
      '}\n' +
      '\n' +
      '/* Dark mode */\n' +
      '@media (prefers-color-scheme: dark) {\n' +
      '  .degenfeed-post {\n' +
      '    border-color: #374151 !important;\n' +
      '    background: #1f2937 !important;\n' +
      '    color: #f3f4f6 !important;\n' +
      '    box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;\n' +
      '  }\n' +
      '  .degenfeed-post:hover {\n' +
      '    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;\n' +
      '  }\n' +
      '  .df-embed-name { color: #f3f4f6 !important; }\n' +
      '  .df-embed-text { color: #e5e7eb !important; }\n' +
      '  .df-embed-handle,\n' +
      '  .df-embed-footer,\n' +
      '  .df-embed-stats { color: #9ca3af !important; }\n' +
      '  .df-embed-footer { border-top-color: #374151 !important; }\n' +
      '  .df-embed-footer a { color: #34d399 !important; }\n' +
      '  .df-embed-badge {\n' +
      '    background: #34d39915 !important;\n' +
      '    color: #34d399 !important;\n' +
      '  }\n' +
      '  .df-embed-avatar { background: #374151 !important; }\n' +
      '  .df-embed-spinner {\n' +
      '    border-color: #374151 !important;\n' +
      '    border-top-color: #34d399 !important;\n' +
      '  }\n' +
      '}';

    document.head.appendChild(css);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return mins + 'm';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + 'd';
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  function getProtocolColor(p) {
    var colors = {
      nostr: '#8e30eb',
      farcaster: '#8a63d2',
      lens: '#abfe2c',
      bluesky: '#1185fe',
      mastodon: '#6364ff',
      threads: '#888888',
      reddit: '#ff4500',
      rss: '#ffa500',
    };
    return colors[p] || '#6b7280';
  }

  // ─── Rendering ───────────────────────────────────────────────────────

  function renderPost(blockquote, postData) {
    var post = postData.data || postData;
    var protocol = post.protocol || '';
    var text = post.text || '';
    var author = post.author ? (post.author.displayName || post.author.handles && post.author.handles[protocol] || 'Unknown') : 'Unknown';
    var handle = post.author && post.author.handles ? post.author.handles[protocol] || '' : '';
    var avatar = post.author ? post.author.avatarUrl || '' : '';
    var metrics = post.metrics || { likes: 0, reposts: 0, replies: 0 };
    var embeds = post.embeds || [];
    var imageUrl = '';
    for (var i = 0; i < embeds.length; i++) {
      if (embeds[i].kind === 'image') {
        imageUrl = embeds[i].url;
        break;
      }
    }

    var postId = post.id || post.dfUri || '';
    var postUrl = API_BASE + '/post/' + encodeURIComponent(postId);
    var protocolLabel = protocol.charAt(0).toUpperCase() + protocol.slice(1);
    var protocolColor = getProtocolColor(protocol);

    // Build rich embed HTML
    var html =
      '<div class="df-embed-row">' +
        '<div class="df-embed-avatar-wrap">' +
          (avatar
            ? '<img class="df-embed-avatar" src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(author) + '" loading="lazy" />'
            : '<div class="df-embed-avatar" style="display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#6b7280;">' + escapeHtml(author.charAt(0).toUpperCase()) + '</div>'
          ) +
        '</div>' +
        '<div class="df-embed-body">' +
          '<div class="df-embed-name-row">' +
            '<span class="df-embed-name">' + escapeHtml(author) + '</span>' +
            '<span class="df-embed-badge" style="color:' + protocolColor + '!important;background:' + protocolColor + '15!important;">' + escapeHtml(protocolLabel) + '</span>' +
          '</div>' +
          (handle ? '<div class="df-embed-handle">@' + escapeHtml(handle) + '</div>' : '') +
          '<div class="df-embed-text">' + escapeHtml(text) + '</div>' +
          (imageUrl
            ? '<div class="df-embed-image"><img src="' + escapeHtml(imageUrl) + '" alt="" loading="lazy" /></div>'
            : ''
          ) +
          '<div class="df-embed-footer">' +
            '<span>' + timeAgo(post.createdAt) + ' ago</span>' +
            '<div class="df-embed-stats">' +
              (metrics.likes > 0 ? '<span>&#10084; ' + formatCount(metrics.likes) + '</span>' : '') +
              (metrics.reposts > 0 ? '<span>&#8634; ' + formatCount(metrics.reposts) + '</span>' : '') +
              (metrics.replies > 0 ? '<span>&#8617; ' + formatCount(metrics.replies) + '</span>' : '') +
            '</div>' +
            '<cite>&mdash; <a href="' + escapeHtml(postUrl) + '" target="_blank" rel="noopener noreferrer">@' + escapeHtml(author) + ' on DegenFeed</a></cite>' +
          '</div>' +
        '</div>' +
      '</div>';

    blockquote.innerHTML = html;
    blockquote.className = 'degenfeed-post df-embed-loaded';
  }

  function showError(blockquote, message) {
    blockquote.innerHTML = '<div class="df-embed-error">' + escapeHtml(message || 'Could not load post') + '</div>';
    blockquote.className = 'degenfeed-post df-embed-error';
  }

  function showLoading(blockquote) {
    blockquote.innerHTML = '<div class="df-embed-loading"><span class="df-embed-spinner"></span> Loading post&hellip;</div>';
  }

  // ─── Fetch & Hydrate ────────────────────────────────────────────────

  function hydrateBlockquote(blockquote) {
    var postUri = blockquote.getAttribute('data-post-uri');
    var postId = blockquote.getAttribute('data-post-id');

    // Show loading state
    showLoading(blockquote);

    // Determine the API endpoint
    var apiPath = postId
      ? '/api/feed/post/' + encodeURIComponent(postId)
      : postUri
        ? '/api/content/' + encodeURIComponent(postUri)
        : null;

    if (!apiPath) {
      showError(blockquote, 'No post identifier found');
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + apiPath, true);
    xhr.withCredentials = false;

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data && (data.data || data.protocol)) {
            renderPost(blockquote, data);
          } else {
            showError(blockquote, 'Post data unavailable');
          }
        } catch (e) {
          showError(blockquote, 'Failed to parse post data');
        }
      } else if (xhr.status === 404) {
        showError(blockquote, 'Post not found');
      } else {
        showError(blockquote, 'Error loading post');
      }
    };

    xhr.onerror = function () {
      showError(blockquote, 'Network error');
    };

    xhr.send();
  }

  // ─── Initialization ──────────────────────────────────────────────────

  function init() {
    // Inject styles
    injectStyles();

    // Find all degenfeed-post blockquotes
    var blockquotes = document.querySelectorAll('blockquote.degenfeed-post');
    var count = blockquotes.length;

    if (count === 0) return;

    // Hydrate each blockquote
    for (var i = 0; i < count; i++) {
      (function (el) {
        // Don't re-hydrate already loaded embeds
        if (el.classList.contains('df-embed-loaded')) return;

        // Use requestAnimationFrame for non-blocking hydration
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(function () {
            hydrateBlockquote(el);
          });
        } else {
          setTimeout(function () {
            hydrateBlockquote(el);
          }, 0);
        }
      })(blockquotes[i]);
    }
  }

  // ─── Boot ────────────────────────────────────────────────────────────

  // Run on DOMContentLoaded, or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also watch for dynamic content changes (e.g., SPAs inserting embeds)
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (mutations) {
      var needsHydration = false;
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          if (addedNodes[j].nodeType === 1) {
            if (addedNodes[j].matches && addedNodes[j].matches('blockquote.degenfeed-post')) {
              needsHydration = true;
              break;
            }
            if (addedNodes[j].querySelectorAll) {
              var nested = addedNodes[j].querySelectorAll('blockquote.degenfeed-post');
              if (nested.length > 0) {
                needsHydration = true;
                break;
              }
            }
          }
        }
        if (needsHydration) break;
      }
      if (needsHydration) {
        var blockquotes = document.querySelectorAll('blockquote.degenfeed-post:not(.df-embed-loaded)');
        for (var k = 0; k < blockquotes.length; k++) {
          (function (el) {
            hydrateBlockquote(el);
          })(blockquotes[k]);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();

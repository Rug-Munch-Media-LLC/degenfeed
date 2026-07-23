'use client';

import { useAuth } from '../../../components/AuthProvider';
import { useWeb3 } from '../../../components/Web3Provider';
import { formatTimeAgo, shortenAddress } from '@degenfeed/utils';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// === Types =========================================================

interface GhostPost {
  id: string;
  slug: string;
  title: string;
  html: string;
  excerpt: string;
  featuredImage?: string;
  readingTime: number;
  publishedAt: string;
  tags: string[];
  authors: { name: string; avatar: string }[];
  tippedAmount: string;
  subscriberOnly: boolean;
  minTokenHold?: string;
  tipAddresses?: {
    eth?: string;
    sol?: string;
    btc?: string;
    lightning?: string;
  };
}

// === Tip Modal =====================================================

function TipModal({
  isOpen,
  onClose,
  postTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  postTitle: string;
}) {
  const { account: address } = useWeb3();
  const [amount, setAmount] = useState('0.01');
  const [currency, setCurrency] = useState<'ETH' | 'SOL' | 'BTC'>('ETH');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const handleTip = async () => {
    if (!address) return;
    setSending(true);
    try {
      // In production, this would call the actual tip contract/transfer
      await new Promise((r) => setTimeout(r, 1500));
      setDone(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#1f2937] bg-[#111827] p-6 shadow-2xl">
        {done ? (
          <div className="text-center">
            <div className="mb-3 text-3xl">✦</div>
            <h3 className="mb-2 text-lg font-semibold text-[#e5e7eb]">Tip Sent!</h3>
            <p className="mb-4 text-sm text-[#9ca3af]">
              Thank you for supporting this article.
            </p>
            <button
              onClick={onClose}
              className="rounded-lg bg-[#00ff41] px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#00cc34]"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 className="mb-1 text-lg font-semibold text-[#e5e7eb]">✦ Tip the Author</h3>
            <p className="mb-4 text-sm text-[#9ca3af]">Support &ldquo;{postTitle.slice(0, 60)}&rdquo;</p>

            {!address ? (
              <div className="mb-4 rounded-lg bg-[#1f2937] p-4 text-center">
                <p className="mb-2 text-sm text-[#9ca3af]">Connect your wallet to send a tip</p>
                <button className="rounded-lg bg-[#00ff41] px-4 py-2 text-sm font-semibold text-black">
                  Connect Wallet
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="mb-1 block text-xs text-[#9ca3af]">Currency</label>
                  <div className="flex gap-2">
                    {(['ETH', 'SOL', 'BTC'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCurrency(c)}
                        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                          currency === c
                            ? 'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41]'
                            : 'border-[#374151] text-[#9ca3af] hover:border-[#00ff41]/50'
                        }`}
                      >
                        {c === 'ETH' ? '⟠' : c === 'SOL' ? '◎' : '₿'} {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-1 block text-xs text-[#9ca3af]">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.001"
                    min="0"
                    className="w-full rounded-lg border border-[#374151] bg-[#1f2937] px-3 py-2 text-sm text-[#e5e7eb] outline-none focus:border-[#00ff41]"
                  />
                </div>

                <div className="mb-4 rounded-lg bg-[#1f2937] p-3">
                  <p className="text-xs text-[#6b7280]">
                    From: {shortenAddress(address)}
                  </p>
                  <p className="mt-1 text-xs text-[#6b7280]">
                    You will send {amount} {currency}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-lg border border-[#374151] py-2 text-sm text-[#9ca3af] transition-colors hover:border-[#6b7280]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTip}
                    disabled={sending}
                    className="flex-1 rounded-lg bg-[#00ff41] py-2 text-sm font-semibold text-black transition-colors hover:bg-[#00cc34] disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : `Send ${amount} ${currency}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// === Share Menu ====================================================

function ShareMenu({ post }: { post: GhostPost }) {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = `${post.title} — DegenFeed`;

  const shareLinks = [
    { name: 'Twitter/X', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, color: '#1da1f2' },
    { name: 'Nostr', url: `nostr:${encodeURIComponent(url)}`, color: '#8e30eb' },
    { name: 'Warpcast', url: `https://warpcast.com/~/compose?text=${encodeURIComponent(`${text} ${url}`)}`, color: '#8a63d2' },
    { name: 'Lens', url: `https://hey.xyz/?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, color: '#abfe2c' },
    { name: 'Bluesky', url: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`, color: '#1185fe' },
    { name: 'Copy Link', url: '', color: '#6b7280' },
  ];

  const handleShare = async (link: (typeof shareLinks)[number]) => {
    if (link.name === 'Copy Link') {
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copied!');
      } catch { /* fallback */ }
      return;
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap gap-2">
      {shareLinks.map((link) => (
        <button
          key={link.name}
          onClick={() => handleShare(link)}
          className="rounded-lg border border-[#374151] px-3 py-1.5 text-xs transition-colors hover:border-[#6b7280]"
          style={{ color: link.color }}
        >
          {link.name}
        </button>
      ))}
    </div>
  );
}

// === Newsletter Subscribe CTA ======================================

function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ghost/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier: 'free' }),
      });
      if (res.ok) setSubscribed(true);
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="rounded-xl border border-[#00ff41]/30 bg-[#00ff41]/5 p-6 text-center">
        <p className="text-sm font-medium text-[#00ff41]">✓ Subscribed!</p>
        <p className="mt-1 text-xs text-[#9ca3af]">Check your inbox for confirmation.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-6">
      <h3 className="mb-1 text-sm font-semibold text-[#e5e7eb]">📫 Subscribe to DegenFeed</h3>
      <p className="mb-4 text-xs text-[#9ca3af]">
        Get the best of web3, AI, and crypto delivered weekly. Free forever.
      </p>
      <form onSubmit={handleSubscribe} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 rounded-lg border border-[#374151] bg-[#1f2937] px-3 py-2 text-sm text-[#e5e7eb] outline-none placeholder:text-[#6b7280] focus:border-[#00ff41]"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#00ff41] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#00cc34] disabled:opacity-50"
        >
          {loading ? '...' : 'Subscribe'}
        </button>
      </form>
      <p className="mt-2 text-xs text-[#6b7280]">No spam. Unsubscribe anytime.</p>
    </div>
  );
}

// === Token Gate ====================================================

function TokenGate({ post }: { post: GhostPost }) {
  const { account: address } = useWeb3();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (!address || !post.minTokenHold) {
      setHasToken(false);
      return;
    }
    // Check token balance — in production, call a balanceOf function
    const check = async () => {
      try {
        const res = await fetch(`/api/token-gate/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            minTokenHold: post.minTokenHold,
          }),
        });
        const data = await res.json() as { ok: boolean };
        setHasToken(data.ok);
      } catch {
        setHasToken(false);
      }
    };
    check();
  }, [address, post.minTokenHold]);

  if (hasToken === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00ff41] border-t-transparent" />
      </div>
    );
  }

  if (hasToken) {
    return (
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    );
  }

  // Gated content
  return (
    <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-8 text-center">
      <div className="mb-4 text-4xl">🔒</div>
      <h3 className="mb-2 text-lg font-semibold text-[#e5e7eb]">Subscribers Only</h3>
      <p className="mb-6 text-sm text-[#9ca3af]">
        This article requires holding {post.minTokenHold || 'a minimum token balance'} to view.
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => window.location.href = '/premium'}
          className="rounded-lg bg-[#00ff41] px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#00cc34]"
        >
          Upgrade to Premium
        </button>
        <button
          onClick={() => window.history.back()}
          className="rounded-lg border border-[#374151] px-4 py-2 text-sm text-[#9ca3af]"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

// === Main Article Page =============================================

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { account: address } = useWeb3();

  const [post, setPost] = useState<GhostPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTipModal, setShowTipModal] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ghost/posts/${slug}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Article not found');
          throw new Error('Failed to load article');
        }
        const data = await res.json() as { post: GhostPost };
        setPost(data.post);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [slug]);

  // == Loading State =============================================

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-3/4 rounded-lg bg-[#1f2937]" />
          <div className="h-4 w-1/4 rounded bg-[#1f2937]" />
          <div className="h-64 rounded-xl bg-[#1f2937]" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-[#1f2937]" />
            <div className="h-4 rounded bg-[#1f2937]" />
            <div className="h-4 w-2/3 rounded bg-[#1f2937]" />
          </div>
        </div>
      </div>
    );
  }

  // == Error State ===============================================

  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="mb-4 text-4xl">📄</div>
        <h1 className="mb-2 text-xl font-semibold text-[#e5e7eb]">
          {error || 'Article not found'}
        </h1>
        <p className="mb-6 text-sm text-[#9ca3af]">
          The article you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
        </p>
        <a
          href="/articles"
          className="inline-block rounded-lg bg-[#00ff41] px-6 py-2 text-sm font-semibold text-black"
        >
          Browse Articles
        </a>
      </div>
    );
  }

  // == Success ===================================================

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-xs text-[#6b7280]">
        <a href="/" className="hover:text-[#00ff41]">Home</a>
        <span className="mx-2">/</span>
        <a href="/articles" className="hover:text-[#00ff41]">Articles</a>
        <span className="mx-2">/</span>
        <span className="text-[#9ca3af]">{post.slug}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#374151] px-2.5 py-0.5 text-xs text-[#9ca3af]"
            >
              #{tag}
            </span>
          ))}
          <span className="rounded-full bg-[#00ff41]/10 px-2.5 py-0.5 text-xs text-[#00ff41]">
            {post.readingTime} min read
          </span>
          {post.subscriberOnly && (
            <span className="rounded-full bg-[#f5a623]/10 px-2.5 py-0.5 text-xs text-[#f5a623]">
              🔒 Subscribers
            </span>
          )}
        </div>

        <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-[#f9fafb] md:text-4xl">
          {post.title}
        </h1>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {post.authors.map((author) => (
              <div key={author.name} className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f2937] text-xs font-semibold text-[#00ff41]">
                  {author.avatar ? (
                    <img src={author.avatar} alt={author.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    author.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#e5e7eb]">{author.name}</p>
                  <p className="text-xs text-[#6b7280]">
                    {formatTimeAgo(new Date(post.publishedAt).getTime())}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowTipModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#374151] px-3 py-1.5 text-sm text-[#e5e7eb] transition-colors hover:border-[#00ff41]/50"
          >
            <span>✦</span>
            <span>Tip</span>
          </button>
        </div>
      </header>

      {/* Featured Image */}
      {post.featuredImage && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full object-cover"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}

      {/* Article Content */}
      <div className="mb-12">
        {post.subscriberOnly ? (
          <TokenGate post={post} />
        ) : (
          <div
            className="article-content prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        )}
      </div>

      {/* Cross-Platform Tip Bar */}
      {post.tipAddresses && (
        <div className="mb-8 rounded-xl border border-[#1f2937] bg-[#111827] p-6">
          <h3 className="mb-3 text-sm font-semibold text-[#e5e7eb]">✦ Support the Author</h3>
          <p className="mb-4 text-xs text-[#9ca3af]">Send tips via your preferred network</p>
          <div className="flex flex-wrap gap-2">
            {post.tipAddresses.eth && (
              <button
                onClick={() => setShowTipModal(true)}
                className="rounded-lg border border-[#627eea]/30 bg-[#627eea]/5 px-4 py-2 text-sm text-[#627eea] transition-colors hover:bg-[#627eea]/10"
              >
                ⟠ ETH
              </button>
            )}
            {post.tipAddresses.sol && (
              <button
                onClick={() => setShowTipModal(true)}
                className="rounded-lg border border-[#9945ff]/30 bg-[#9945ff]/5 px-4 py-2 text-sm text-[#9945ff] transition-colors hover:bg-[#9945ff]/10"
              >
                ◎ SOL
              </button>
            )}
            {post.tipAddresses.lightning && (
              <button
                onClick={() => setShowTipModal(true)}
                className="rounded-lg border border-[#f5a623]/30 bg-[#f5a623]/5 px-4 py-2 text-sm text-[#f5a623] transition-colors hover:bg-[#f5a623]/10"
              >
                ⚡ Lightning
              </button>
            )}
            {post.tipAddresses.btc && (
              <button
                onClick={() => setShowTipModal(true)}
                className="rounded-lg border border-[#f7931a]/30 bg-[#f7931a]/5 px-4 py-2 text-sm text-[#f7931a] transition-colors hover:bg-[#f7931a]/10"
              >
                ₿ BTC
              </button>
            )}
          </div>
        </div>
      )}

      {/* Share Section */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-[#e5e7eb]">Share</h3>
        <ShareMenu post={post} />
      </div>

      {/* Newsletter CTA */}
      <div className="mb-8">
        <NewsletterCTA />
      </div>

      {/* Tip Modal */}
      <TipModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        postTitle={post.title}
      />

      {/* Styles for article content */}
      <style jsx global>{`
        .article-content {
          color: #d1d5db;
          font-size: 16px;
          line-height: 1.8;
        }
        .article-content h1, .article-content h2, .article-content h3 {
          color: #f9fafb;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .article-content h1 { font-size: 1.75rem; }
        .article-content h2 { font-size: 1.4rem; }
        .article-content h3 { font-size: 1.15rem; }
        .article-content p { margin-bottom: 1em; }
        .article-content a { color: #00ff41; text-decoration: underline; }
        .article-content a:hover { color: #00cc34; }
        .article-content blockquote {
          border-left: 3px solid #00ff41;
          padding-left: 1em;
          color: #9ca3af;
          font-style: italic;
          margin: 1.5em 0;
        }
        .article-content pre {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
        }
        .article-content code {
          background: #1f2937;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          color: #00ff41;
        }
        .article-content pre code {
          background: none;
          padding: 0;
          color: #e5e7eb;
        }
        .article-content img {
          border-radius: 8px;
          max-width: 100%;
          height: auto;
          margin: 1.5em 0;
        }
        .article-content ul, .article-content ol {
          padding-left: 1.5em;
          margin-bottom: 1em;
        }
        .article-content li { margin-bottom: 0.25em; }
        .article-content hr {
          border: none;
          border-top: 1px solid #1f2937;
          margin: 2em 0;
        }
      `}</style>
    </article>
  );
}

"use client";

import { useState, useEffect } from "react";
import { FeedShell } from "../../components/FeedShell";
import { useAuth } from "../../components/AuthProvider";
import { ComposeModal, SignInModal } from "@degenfeed/ui";
import { SECTIONS } from "./sections";

function HomeContent() {
  const { signedInProtocols, openSignIn, openCompose, ready } = useAuth();
  const [showCompose, setShowCompose] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const count = Object.keys(signedInProtocols).length;

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-4 h-1 w-48 animate-pulse rounded-full bg-gray-800" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">DegenFeed</h1>
          <p className="text-sm text-gray-500">
            {hasSignedIn
              ? "Connected: " + count + " network" + (count > 1 ? "s" : "")
              : "Every network. One window. Zero sign-ups required."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasSignedIn ? (
            <button type="button" className="btn-primary text-sm" onClick={() => setShowCompose(true)}>Compose</button>
          ) : (
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowSignIn(true)}>Sign In</button>
          )}
        </div>
      </header>

      {/* Signed-in status */}
      {hasSignedIn && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-degen-400">Signed in:</span>
          {Object.keys(signedInProtocols).map((p) => (
            <span key={p} className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: getProtocolColor(p) + "22", color: getProtocolColor(p) }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Section grid */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">Choose a feed</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SECTIONS.map((section) => (
            <a key={section.id} href={"/home/" + section.id}
              className="card group cursor-pointer transition-all hover:border-gray-600 hover:bg-gray-800/50"
              style={{ borderColor: section.color + "33" }}>
              <div className="mb-2 text-2xl" style={{ color: section.color }}>{section.icon}</div>
              <div className="text-sm font-semibold text-white group-hover:text-degen-400">{section.label}</div>
              <div className="mt-1 text-xs text-gray-500 line-clamp-2">{section.description}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Quick info */}
      <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
        <h3 className="mb-2 text-sm font-semibold text-degen-400">
          {hasSignedIn ? "Ready to post?" : "No account? No problem."}
        </h3>
        <p className="text-sm text-gray-400">
          {hasSignedIn
            ? "Click Compose to write a post. Select which networks to publish to."
            : "All content is visible without signing in. Connect an account to like, reply, and repost. Add multiple to cross-post."}
        </p>
        {!hasSignedIn && (
          <button type="button" className="btn-primary mt-3 text-sm" onClick={() => setShowSignIn(true)}>
            Sign in with any protocol
          </button>
        )}
      </div>

      {/* Modals */}
      <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)}
        onSignIn={async (protocol, token) => {
          try {
            const handlers: Record<string, Function> = {
              nostr: () => import("@degenfeed/auth").then(m => m.signInWithNostrNsec(token || "", "auto")),
              bluesky: () => import("@degenfeed/auth").then(m => m.signInWithBluesky(prompt("Bluesky handle:") || "", prompt("App password:") || "", "auto")),
              threads: () => import("@degenfeed/auth").then(m => m.signInWithThreads(prompt("Threads identifier:") || "", prompt("App password:") || "", "auto")),
              mastodon: () => import("@degenfeed/auth").then(m => m.signInWithGtS(prompt("Instance URL:") || "https://social.degenfeed.xyz", prompt("Access token:") || "", "auto")),
            };
            await (handlers[protocol]?.() ?? Promise.resolve());
            setShowSignIn(false);
            window.location.reload();
          } catch (e) { alert("Sign-in failed: " + (e instanceof Error ? e.message : String(e))); }
        }} />
      <ComposeModal open={showCompose} onClose={() => setShowCompose(false)}
        signedInProtocols={signedInProtocols}
        onPublish={async (text, targets) => {
          try {
            const res = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, targets }) });
            return (await res.json()).results ?? {};
          } catch { const r: Record<string, { ok: boolean; error?: string }> = {}; targets.forEach(t => r[t] = { ok: false, error: "Network error" }); return r; }
        }} />
    </div>
  );
}

function getProtocolColor(p: string): string {
  const colors: Record<string, string> = { nostr: "#8e30eb", farcaster: "#8a63d2", lens: "#abfe2c", bluesky: "#1185fe", threads: "#888", mastodon: "#6364ff", rss: "#ffa500" };
  return colors[p] ?? "#666";
}

export default function HomePage() {
  return <FeedShell><HomeContent /></FeedShell>;
}

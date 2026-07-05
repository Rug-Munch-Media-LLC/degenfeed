"use client";

import { useState, useEffect } from "react";
import { FeedShell } from "../../components/FeedShell";
import { useAuth } from "../../components/AuthProvider";

export default function ProfilePage() {
  const { signedInProtocols, tokens, ready } = useAuth();
  const [identities, setIdentities] = useState<Array<{ protocol: string; displayName?: string; handle?: string; avatarUrl?: string }>>([]);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("degenfeed_identities");
      if (stored) setIdentities(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [signedInProtocols]);

  if (!ready) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-white">Profile</h1>

      {!hasSignedIn ? (
        <div className="card py-12 text-center">
          <div className="mb-4 text-4xl text-gray-600">?</div>
          <p className="mb-4 text-gray-500">No accounts connected</p>
          <a href="/home" className="btn-primary text-sm">Sign in to create a profile</a>
        </div>
      ) : (
        <>
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-widest text-gray-500">Connected Accounts</h2>
            {identities.length === 0 ? (
              <p className="text-sm text-gray-600">No stored identities found.</p>
            ) : (
              identities.map((id, i) => (
                <div key={i} className="card flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-lg font-bold"
                    style={{ color: getColor(id.protocol) }}>
                    {(id.protocol[0] || "").toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{id.displayName || id.protocol}</div>
                    <div className="text-xs text-gray-500">{id.handle || id.protocol + " account"}</div>
                  </div>
                  <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: getColor(id.protocol) + "22", color: getColor(id.protocol) }}>
                    {id.protocol}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card border-degen-500/20 bg-degen-500/5 py-8 text-center">
            <p className="mb-3 text-sm text-degen-400">
              Want to add another network?
            </p>
            <a href="/home" className="btn-primary text-sm">Connect another account</a>
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <a href="/home" className="text-sm text-gray-600 hover:text-white transition-colors">&larr; Back to feed</a>
      </div>
    </div>
  );
}

function getColor(p: string): string {
  const c: Record<string, string> = { nostr: "#8e30eb", farcaster: "#8a63d2", lens: "#abfe2c", bluesky: "#1185fe", threads: "#888", mastodon: "#6364ff", rss: "#ffa500" };
  return c[p] ?? "#666";
}

"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { SignInModal, ComposeModal, type UnifiedPost } from "@degenfeed/ui";
import { useWalletSignIn } from "../hooks/useWalletSignIn";
import { useWeb3 } from "../components/Web3Provider";

export interface AuthContextValue {
  signedInProtocols: Record<string, boolean>;
  tokens: Record<string, string>;
  walletAddress?: string;
  openSignIn: () => void;
  openCompose: () => void;
  publish: (text: string, targets: string[]) => Promise<Record<string, { ok: boolean; error?: string }>>;
  engage: (action: string, postId: string, protocol: string) => Promise<void>;
  ready: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedInProtocols, setSignedInProtocols] = useState<Record<string, boolean>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const { account: wagmiAddress, isConnected } = useWeb3();
  const { signInWithEthereum, signingIn: walletSigningIn } = useWalletSignIn();

  // Load stored identities on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("degenfeed_identities");
      if (stored) {
        const identities: Array<{ protocol: string; token?: string }> = JSON.parse(stored);
        const protocols: Record<string, boolean> = {};
        const toks: Record<string, string> = {};
        for (const id of identities) {
          protocols[id.protocol] = true;
          if (id.token) toks[id.protocol] = id.token;
        }
        setSignedInProtocols(protocols);
        setTokens(toks);
      }
      const storedWallet = localStorage.getItem("degenfeed_wallet");
      if (storedWallet) setWalletAddress(storedWallet);
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  // Sync wagmi wallet address
  useEffect(() => {
    if (isConnected && wagmiAddress) {
      setWalletAddress(wagmiAddress);
      localStorage.setItem("degenfeed_wallet", wagmiAddress);
    }
  }, [isConnected, wagmiAddress]);

  const handleSignIn = useCallback(async (protocol: string, token?: string) => {
    try {
      if (protocol === "ethereum") {
        const session = await signInWithEthereum();
        if (session) {
          setWalletAddress(session.address);
          localStorage.setItem("degenfeed_wallet", session.address);
          setSignedInProtocols((prev) => ({ ...prev, ethereum: true }));
          if (session.accessToken) {
            setTokens((prev) => ({ ...prev, ethereum: session.accessToken }));
          }
          setShowSignIn(false);
        }
        return;
      }

      switch (protocol) {
        case "nostr": {
          const { signInWithNostrNsec } = await import("@degenfeed/auth");
          if (!token) throw new Error("Nostr nsec required");
          await signInWithNostrNsec(token, "auto-unlock-passphrase");
          break;
        }
        case "farcaster": {
          const { signInWithFarcasterSigner } = await import("@degenfeed/auth");
          const fid = prompt("Farcaster FID (numeric):");
          const username = prompt("Farcaster username:");
          const signerKey = prompt("Signer private key hex:");
          if (!fid || !username || !signerKey) throw new Error("Farcaster credentials required");
          await signInWithFarcasterSigner(signerKey, Number(fid), username, "auto");
          break;
        }
        case "lens": {
          const { signInWithLens } = await import("@degenfeed/auth");
          await signInWithLens({ wallet: (window as any).ethereum });
          break;
        }
        case "bluesky": {
          const { signInWithBluesky } = await import("@degenfeed/auth");
          const handle = prompt("Bluesky handle (user.bsky.social):");
          const appPass = prompt("Bluesky app password:");
          if (!handle || !appPass) throw new Error("Bluesky credentials required");
          await signInWithBluesky(handle, appPass, "auto-unlock");
          break;
        }
        case "threads": {
          const { signInWithThreads } = await import("@degenfeed/auth");
          const identifier = prompt("Threads/AT Protocol identifier:");
          const apPass = prompt("App password:");
          if (!identifier || !apPass) throw new Error("Threads credentials required");
          await signInWithThreads(identifier, apPass, "auto-unlock");
          break;
        }
        case "mastodon": {
          const { signInWithGtS } = await import("@degenfeed/auth");
          const instance = prompt("Mastodon instance URL (https://social.degenfeed.xyz):") || "https://social.degenfeed.xyz";
          const accessToken = prompt("Access token:");
          if (!accessToken) throw new Error("Access token required");
          await signInWithGtS(instance, accessToken, "auto-unlock");
          break;
        }
        default:
          throw new Error("Unknown protocol: " + protocol);
      }
      setSignedInProtocols((prev) => ({ ...prev, [protocol]: true }));
      try {
        const stored = localStorage.getItem("degenfeed_identities");
        if (stored) {
          const identities: Array<{ protocol: string; token?: string }> = JSON.parse(stored);
          const toks: Record<string, string> = {};
          for (const id of identities) {
            if (id.token) toks[id.protocol] = id.token;
          }
          setTokens((prev) => ({ ...prev, ...toks }));
        }
      } catch { /* ignore */ }
      setShowSignIn(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      alert("Sign-in failed: " + message);
    }
  }, [signInWithEthereum]);

  const handlePublish = useCallback(
    async (text: string, targets: string[]): Promise<Record<string, { ok: boolean; error?: string }>> => {
      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, targets, auth: tokens }),
        });
        const data = await res.json();
        return data.results ?? {};
      } catch (err) {
        const results: Record<string, { ok: boolean; error?: string }> = {};
        for (const t of targets) results[t] = { ok: false, error: "Network error" };
        return results;
      }
    },
    [tokens],
  );

  const handleEngage = useCallback(
    async (action: string, postId: string, protocol: string) => {
      try {
        await fetch("/api/engage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, postId, protocol, auth: tokens[protocol] }),
        });
      } catch { /* silently fail */ }
    },
    [tokens],
  );

  return (
    <AuthContext.Provider
      value={{
        signedInProtocols,
        tokens,
        walletAddress,
        openSignIn: () => setShowSignIn(true),
        openCompose: () => setShowCompose(true),
        publish: handlePublish,
        engage: handleEngage,
        ready,
      }}
    >
      {children}

      <SignInModal
        open={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSignIn={handleSignIn}
        walletAddress={walletAddress}
        walletSigningIn={walletSigningIn}
      />

      <ComposeModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        signedInProtocols={signedInProtocols}
        onPublish={handlePublish}
      />
    </AuthContext.Provider>
  );
}

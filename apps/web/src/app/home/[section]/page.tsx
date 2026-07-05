"use client";

import { useState, useEffect } from "react";
import { FeedShell } from "../../../components/FeedShell";
import { useAuth } from "../../../components/AuthProvider";
import { FeedList, type UnifiedPost } from "@degenfeed/ui";
import { SECTIONS } from "../sections";

interface Props {
  params: Promise<{ section: string }>;
}

function SectionContent({ section }: { section: string }) {
  const { engage } = useAuth();
  const meta = SECTIONS.find((s) => s.id === section);
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "empty" | "error">("loading");
  const [error, setError] = useState<string>();

  const displayName = meta?.label ?? section;
  const color = meta?.color ?? "#666";
  const icon = meta?.icon ?? "\u25CF";

  // Fetch data from worker API
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const url = new URL(meta?.endpoint || "/api/feed/home", window.location.origin);
        url.searchParams.set("limit", String(meta?.limit || 25));
        if (meta?.params) {
          for (const [k, v] of Object.entries(meta.params)) url.searchParams.set(k, v);
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("API returned " + res.status);
        const data = await res.json() as { data?: UnifiedPost[] };
        if (cancelled) return;
        if (!data.data || data.data.length === 0) {
          setState("empty");
        } else {
          setPosts(data.data);
          setState("loaded");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setState("error");
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [section, meta?.endpoint, meta?.limit]);

  if (!meta) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="mb-4 text-2xl font-bold text-white">Section not found</h1>
        <p className="mb-6 text-gray-500">No feed section named "{section}".</p>
        <a href="/home" className="btn-primary">Back to sections</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <a href="/home" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white">
          &larr; All sections
        </a>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl" style={{ color }}>{icon}</span>
          <div><h1 className="text-2xl font-bold text-white">{displayName}</h1></div>
          <span className="ml-auto rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: color + "22", color }}>
            {displayName}
          </span>
        </div>
      </div>

      <FeedList
        state={state}
        posts={posts}
        error={error}
        protocolLabel={displayName}
        protocolColor={color}
        onPostClick={(id) => { window.location.href = "/post/" + encodeURIComponent(id); }}
        onEngage={(action, postId) => engage(action, postId, section)}
        onRetry={() => setState("loading")}
      />
    </div>
  );
}

export default async function SectionPage({ params }: Props) {
  const section = (await params).section;
  return (
    <FeedShell>
      <SectionContent section={section} />
    </FeedShell>
  );
}

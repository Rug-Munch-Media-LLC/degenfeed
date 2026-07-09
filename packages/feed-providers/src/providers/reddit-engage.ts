import type { UnifiedPost } from "@degenfeed/types";

const REDLIB_URL = typeof process !== "undefined"
  ? (process.env?.REDLIB_URL ?? "http://127.0.0.1:8281")
  : "http://127.0.0.1:8281";

export interface RedditEngageResult {
  ok: boolean;
  error?: string;
}

export async function engageReddit(opts: {
  action: "like" | "unlike" | "reply" | "repost";
  postId: string;
  subreddit: string;
  commentId?: string;
  content?: string;
  token?: string;
}): Promise<RedditEngageResult> {
  try {
    const effectiveAction = opts.action === "like" ? "upvote" : opts.action === "unlike" ? "downvote" : opts.action;
    if (effectiveAction === "reply") {
      return { ok: false, error: "Reddit comment posting requires OAuth. Coming soon." };
    }
    if (effectiveAction === "repost") {
      return { ok: false, error: "Reddit crosspost requires OAuth. Coming soon." };
    }
    // Voting via Redlib: POST /r/{sub}/api/vote with id=postId&dir=1 (up) or -1 (down)
    const formBody = new URLSearchParams({
      id: `t3_${opts.postId}`,
      dir: effectiveAction === "upvote" ? "1" : "-1",
    });
    const res = await fetch(`${REDLIB_URL}/r/${opts.subreddit}/api/vote`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    if (!res.ok) {
      return { ok: false, error: `Redlib vote failed: ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reddit engagement failed" };
  }
}

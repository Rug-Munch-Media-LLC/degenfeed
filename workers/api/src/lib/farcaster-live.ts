/**
 * @degenfeed/api-worker — Farcaster Live Activity Helpers
 *
 * Implements FIP #268 (Live Activity Status) and FIP #269 (Live Activity Manifest)
 * for DegenFeed streams and spaces.
 *
 * Live Activity flow:
 *   1. Creator starts a stream/space → server builds the activity URL
 *   2. Activity URL serves `fc:live=1` meta tags (per FIP #269)
 *   3. Creator's signer writes USER_DATA_TYPE_LIVE_AT = activity URL (per FIP #268)
 *   4. Activity URL hosts a manifest endpoint with JFS host attestation
 *   5. A cast is created referencing the activity URL as embed → becomes chat anchor
 *
 * @see https://github.com/farcasterxyz/protocol/discussions/269
 * @see https://github.com/farcasterxyz/protocol/discussions/268
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type LiveActivityType =
	| "live-video"
	| "live-audio-space"
	| "live-event"
	| "live-stream";

export interface LiveActivityMeta {
	type: LiveActivityType;
	title: string;
	description?: string;
	image?: string;
	hostFid: number;
	startedAt?: number;
	speakerFids?: number[];
	participantCount?: number;
	expectedDurationSec?: number;
	recordingUrl?: string;
	/** URL of the cast that anchors chat for this activity */
	castHash?: string;
	/** Protocol: webrtc, hls, rtmp, dash, srt or comma-separated */
	protocol?: string;
	/** HLS playlist URL for video streams (fc:frame:video) */
	hlsUrl?: string;
}

export interface LiveActivityManifest {
	type: LiveActivityType;
	version: "2026.1";
	hostAttestation: {
		header: string;
		payload: string;
		signature: string;
	} | null;
	metadata: {
		title: string;
		description: string;
		image?: string;
	};
	state: {
		startedAt?: number;
		participantCount?: number;
		speakerFids?: number[];
	};
	protocols?: Array<{
		type: string;
		playlist?: string;
		sdp?: string;
		privacy?: string;
	}>;
}

// ─── Live Activity Meta Tag Builder ─────────────────────────────────────────

/**
 * Build HTML meta tags for the Live Activity Manifest (FIP #269).
 *
 * These tags are served on the activity URL (e.g., https://app.degenfeed.xyz/live/<id>)
 * so Farcaster clients can render the activity card.
 *
 * Required: fc:live, fc:live:hostFid, and the manifest link rel.
 * All other tags are optional per spec.
 */
export function buildLiveActivityMetaTags(activity: LiveActivityMeta): string {
	const tags: string[] = [];

	// Required: mark this URL as a live activity
	tags.push('<meta property="fc:live" content="1" />');
	tags.push(
		`<meta property="fc:live:hostFid" content="${activity.hostFid}" />`,
	);

	// Optional dynamic state
	if (activity.startedAt) {
		tags.push(
			`<meta property="fc:live:startedAt" content="${new Date(activity.startedAt).toISOString()}" />`,
		);
	}

	if (activity.speakerFids && activity.speakerFids.length > 0) {
		tags.push(
			`<meta property="fc:live:speakerFids" content="${activity.speakerFids.join(",")}" />`,
		);
	}

	if (activity.participantCount !== undefined) {
		tags.push(
			`<meta property="fc:live:participantCount" content="${activity.participantCount}" />`,
		);
	}

	if (activity.expectedDurationSec) {
		tags.push(
			`<meta property="fc:live:expectedDurationSec" content="${activity.expectedDurationSec}" />`,
		);
	}

	if (activity.recordingUrl) {
		tags.push(
			`<meta property="fc:live:recordingUrl" content="${activity.recordingUrl}" />`,
		);
	}

	// Cast anchor for chat
	if (activity.castHash) {
		tags.push(`<meta property="fc:cast" content="${activity.castHash}" />`);
	}

	// Protocol hint for clients (per FIP #269 recommendation)
	if (activity.protocol) {
		tags.push(
			`<meta property="fc:live:protocol" content="${activity.protocol}" />`,
		);
	}

	// Manifest pointer (required)
	const manifestUrl = `https://app.degenfeed.xyz/.well-known/farcaster.json`;
	tags.push(
		`<link rel="farcaster-live-activity-manifest" href="${manifestUrl}" />`,
	);

	// Standard OpenGraph tags for fallback rendering
	tags.push(
		`<meta property="og:title" content="${escapeHtml(activity.title)}" />`,
	);
	if (activity.description) {
		tags.push(
			`<meta property="og:description" content="${escapeHtml(activity.description)}" />`,
		);
	}
	if (activity.image) {
		tags.push(`<meta property="og:image" content="${activity.image}" />`);
	}
	tags.push('<meta property="og:type" content="video.other" />');

	// Cache-Control: no-cache is REQUIRED per FIP #269 for pages serving fc:live tags
	tags.push(
		'<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />',
	);

	return tags.join("\n    ");
}

// ─── Live Activity Manifest Builder ─────────────────────────────────────────

/**
 * Build the Live Activity Manifest JSON object.
 *
 * The manifest is served at the URL linked by `farcaster-live-activity-manifest`.
 * It contains the host attestation (JFS signature) binding the activity URL to
 * the host's Farcaster identity.
 */
export function buildLiveActivityManifest(
	activity: LiveActivityMeta,
	hostAttestation: {
		header: string;
		payload: string;
		signature: string;
	} | null,
): LiveActivityManifest {
	const manifest: LiveActivityManifest = {
		type: activity.type,
		version: "2026.1",
		hostAttestation,
		metadata: {
			title: activity.title,
			description: activity.description ?? "",
			image: activity.image,
		},
		state: {
			startedAt: activity.startedAt,
			participantCount: activity.participantCount ?? 1,
			speakerFids: activity.speakerFids,
		},
	};

	// Add protocol info if available
	if (activity.hlsUrl || activity.protocol) {
		manifest.protocols = [];
		if (activity.hlsUrl) {
			manifest.protocols.push({
				type: "hls",
				playlist: activity.hlsUrl,
			});
		}
		if (activity.protocol && activity.protocol !== "hls") {
			manifest.protocols.push({
				type: activity.protocol,
			});
		}
	}

	return manifest;
}

// ─── Frame HTML Builder (Video + Live) ──────────────────────────────────────

/**
 * Generate the complete HTML page for a Farcaster Frame.
 *
 * Supports:
 *   - Standard Frames v1 (fc:frame:image + buttons)
 *   - Video Frames (fc:frame:video + fc:frame:video:type for HLS)
 *   - Live Activity Frames (fc:live + fc:frame:image)
 *   - Frames v2 (single fc:frame meta tag with JSON)
 */
export function generateFrameHtml(params: {
	/** Frame image URL (required for v1, fallback for video frames) */
	image: string;
	/** Frame image aspect ratio: '1.91:1' or '1:1' */
	imageAspectRatio?: "1.91:1" | "1:1";
	/** Buttons (max 4) */
	buttons?: Array<{
		index: number;
		label: string;
		action?: "post" | "post_redirect" | "link" | "mint" | "tx";
		target?: string;
	}>;
	/** POST URL for frame actions */
	postUrl?: string;
	/** Optional input text placeholder */
	inputText?: string;
	/** Optional state string (max 4096 bytes) */
	state?: string;
	/** Video frame: HLS playlist URL (fc:frame:video) */
	videoUrl?: string;
	/** Video frame: MIME type (default: 'application/x-mpegURL') */
	videoType?: string;
	/** Live activity meta (FIP #269) */
	liveActivity?: LiveActivityMeta;
	/** Frame title for OG */
	title?: string;
	/** Frame description for OG */
	description?: string;
	/** Refresh interval in seconds for live-updating frame image */
	refreshInterval?: number;
}): string {
	const {
		image,
		imageAspectRatio = "1.91:1",
		buttons = [],
		postUrl,
		inputText,
		state,
		videoUrl,
		videoType = "application/x-mpegURL",
		liveActivity,
		title = "DegenFeed",
		description = "Live on DegenFeed",
		refreshInterval,
	} = params;

	const lines: string[] = [
		"<!DOCTYPE html>",
		'<html lang="en">',
		"<head>",
		'  <meta charset="utf-8" />',
		'  <meta name="viewport" content="width=device-width, initial-scale=1" />',
		"",
		"  <!-- OpenGraph -->",
		`  <meta property="og:title" content="${escapeHtml(title)}" />`,
		`  <meta property="og:description" content="${escapeHtml(description)}" />`,
		`  <meta property="og:image" content="${escapeHtml(image)}" />`,
		'  <meta property="og:type" content="website" />',
		"",
		"  <!-- Farcaster Frame v1 -->",
		'  <meta property="fc:frame" content="vNext" />',
		`  <meta property="fc:frame:image" content="${escapeHtml(image)}" />`,
		`  <meta property="fc:frame:image:aspect_ratio" content="${imageAspectRatio}" />`,
	];

	// Video Frame support (fc:frame:video per streamethorg spec)
	if (videoUrl) {
		lines.push("");
		lines.push("  <!-- Farcaster Video Frame (HLS) -->");
		lines.push(
			`  <meta property="fc:frame:video" content="${escapeHtml(videoUrl)}" />`,
		);
		lines.push(
			`  <meta property="fc:frame:video:type" content="${videoType}" />`,
		);
	}

	// Post URL
	if (postUrl) {
		lines.push(
			`  <meta property="fc:frame:post_url" content="${escapeHtml(postUrl)}" />`,
		);
	}

	// Input text
	if (inputText) {
		lines.push(
			`  <meta property="fc:frame:input:text" content="${escapeHtml(inputText)}" />`,
		);
	}

	// State
	if (state) {
		lines.push(
			`  <meta property="fc:frame:state" content="${escapeHtml(state)}" />`,
		);
	}

	// Refresh interval for live-updating frame image
	if (refreshInterval) {
		lines.push(
			`  <meta property="fc:frame:refresh_period" content="${refreshInterval}" />`,
		);
	}

	// Buttons
	for (const btn of buttons) {
		lines.push(
			`  <meta property="fc:frame:button:${btn.index}" content="${escapeHtml(btn.label)}" />`,
		);
		if (btn.action && btn.action !== "post") {
			lines.push(
				`  <meta property="fc:frame:button:${btn.index}:action" content="${btn.action}" />`,
			);
		}
		if (btn.target) {
			lines.push(
				`  <meta property="fc:frame:button:${btn.index}:target" content="${escapeHtml(btn.target)}" />`,
			);
		}
	}

	// Live Activity meta tags (FIP #269)
	if (liveActivity) {
		lines.push("");
		lines.push("  <!-- Farcaster Live Activity (FIP #269) -->");
		const liveTags = buildLiveActivityMetaTags(liveActivity);
		for (const tag of liveTags.split("\n")) {
			lines.push(`  ${tag.trim()}`);
		}
	}

	// Open Frames compatibility
	lines.push("");
	lines.push("  <!-- Open Frames -->");
	lines.push('  <meta property="of:version" content="vNext" />');
	lines.push(`  <meta property="of:accepts:xmtp" content="2024.02.02" />`);
	lines.push(`  <meta property="of:image" content="${escapeHtml(image)}" />`);
	lines.push(
		`  <meta property="of:image:aspect_ratio" content="${imageAspectRatio}" />`,
	);
	if (postUrl) {
		lines.push(
			`  <meta property="of:post_url" content="${escapeHtml(postUrl)}" />`,
		);
	}

	lines.push("</head>");
	lines.push("<body>");
	lines.push("  <p>DegenFeed Frame</p>");
	lines.push("</body>");
	lines.push("</html>");

	return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

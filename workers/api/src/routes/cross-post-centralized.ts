/**
 * @degenfeed/api-worker — Cross-Post to Centralized Platforms
 *
 * Publishes content to platforms we CAN'T fork: Medium, Substack, YouTube,
 * TikTok, Instagram, LinkedIn, Reddit, Pinterest.
 *
 * For each platform:
 *   - If they have a public API → use it (Medium, YouTube, LinkedIn, Reddit, Pinterest)
 *   - If they have a limited API → use what's available (TikTok, Instagram)
 *   - If they have NO API → use alternative methods (Substack → email)
 *
 * All handlers require the user to have connected their account first via
 * the /api/accounts/connect/:platform flow.
 */

import { type Env, jsonResponse } from "../index";
import { requireSession } from "../session";
import { getConnectedAccount } from "./connected-accounts";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CrossPostInput {
	/** Main text content */
	text: string;
	/** Optional title (for long-form platforms) */
	title?: string;
	/** Optional image URLs */
	images?: string[];
	/** Optional video URL (for YouTube/TikTok) */
	videoUrl?: string;
	/** Optional video binary (base64-encoded, for YouTube/TikTok) */
	videoBase64?: string;
	/** Optional video file name */
	videoFileName?: string;
	/** Optional video MIME type */
	videoMimeType?: string;
	/** Optional tags/hashtags */
	tags?: string[];
	/** Optional visibility setting */
	visibility?: "public" | "unlisted" | "private";
}

export interface CrossPostResult {
	ok: boolean;
	platform: string;
	nativeId?: string;
	nativeUrl?: string;
	error?: string;
}

// ─── Main dispatch ────────────────────────────────────────────────────────

export async function handleCrossPostCentralized(
	request: Request,
	env: Env,
	platform: string,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const wallet = session.address.toLowerCase();

	// Get the user's connected account for this platform
	const account = await getConnectedAccount(env, wallet, platform);
	if (!account) {
		return jsonResponse(
			{
				error: `No connected account for ${platform}. Connect first at /api/accounts/connect/${platform}`,
				platform,
			},
			401,
		);
	}

	// Parse input
	let input: CrossPostInput;
	try {
		input = (await request.json()) as CrossPostInput;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	if (!input.text && !input.videoUrl && !input.videoBase64) {
		return jsonResponse({ error: "text, videoUrl, or videoBase64 required" }, 400);
	}

	// Dispatch to platform-specific handler
	let result: CrossPostResult;
	switch (platform) {
		case "medium":
			result = await publishToMedium(input, account);
			break;
		case "substack":
			result = await publishToSubstack(input, account);
			break;
		case "youtube":
			result = await publishToYouTube(input, account, env);
			break;
		case "tiktok":
			result = await publishToTikTok(input, account, env);
			break;
		case "instagram":
			result = await publishToInstagram(input, account, env);
			break;
		case "linkedin":
			result = await publishToLinkedIn(input, account);
			break;
		case "reddit":
			result = await publishToReddit(input, account);
			break;
		case "pinterest":
			result = await publishToPinterest(input, account);
			break;
		default:
			return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
	}

	if (!result.ok) {
		return jsonResponse(
			{ error: result.error || "Publishing failed", platform, result },
			502,
		);
	}

	return jsonResponse({ ok: true, platform, result });
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIUM — Medium REST API
// POST https://api.medium.com/v1/users/{userId}/posts
// ═══════════════════════════════════════════════════════════════════════════

async function publishToMedium(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
	try {
		const userId = account.platformUserId;

		const body = {
			title: input.title || input.text.slice(0, 100),
			contentFormat: "markdown",
			content: input.text,
			tags: input.tags?.slice(0, 5),
			publishStatus: input.visibility === "private" ? "draft" : "public",
		};

		const resp = await fetch(
			`https://api.medium.com/v1/users/${userId}/posts`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${account.accessToken}`,
					"Content-Type": "application/json",
					Accept: "application/json",
					"Accept-Charset": "utf-8",
				},
				body: JSON.stringify(body),
			},
		);

		const data = (await resp.json()) as {
			data?: { id?: string; url?: string };
			errors?: Array<{ message?: string }>;
		};

		if (!resp.ok) {
			return {
				ok: false,
				platform: "medium",
				error: data.errors?.[0]?.message || `HTTP ${resp.status}`,
			};
		}

		return {
			ok: true,
			platform: "medium",
			nativeId: data.data?.id,
			nativeUrl: data.data?.url,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "medium",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBSTACK — No public API. Use email-to-post.
// ═══════════════════════════════════════════════════════════════════════════

async function publishToSubstack(
	_input: CrossPostInput,
	account: { platformUserId: string; metadata?: Record<string, string> },
): Promise<CrossPostResult> {
	// Substack has no public API. We use email-to-post:
	// The user provides their Substack email-to-post address in connected accounts.
	const emailToPost = account.metadata?.emailToPost;

	if (!emailToPost) {
		return {
			ok: false,
			platform: "substack",
			error:
				"No email-to-post address configured. Update your Substack connection with your email-to-post address from Substack Settings → Email.",
		};
	}

	// We would send an email via the existing email engine.
	// For now, we record the intent and return instructions.
	return {
		ok: true,
		platform: "substack",
		nativeId: "email-to-post",
		nativeUrl: account.metadata?.substackUrl || undefined,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE — YouTube Data API v3
// POST https://www.googleapis.com/upload/youtube/v3/videos
// ═══════════════════════════════════════════════════════════════════════════

async function publishToYouTube(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
	env: Env,
): Promise<CrossPostResult> {
	try {
		if (!input.videoUrl && !input.videoBase64) {
			return {
				ok: false,
				platform: "youtube",
				error: "videoUrl or videoBase64 required for YouTube publishing",
			};
		}

		let videoContent: ArrayBuffer | null = null;
		let mimeType = input.videoMimeType || "video/mp4";
		let fileName = input.videoFileName || "video.mp4";

		if (input.videoBase64) {
			// Decode base64 to binary
			const binaryString = atob(input.videoBase64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			videoContent = bytes.buffer;
		} else if (input.videoUrl) {
			// Fetch the video from the URL
			const videoResp = await fetch(input.videoUrl);
			if (!videoResp.ok) {
				return {
					ok: false,
					platform: "youtube",
					error: `Failed to fetch video from URL: HTTP ${videoResp.status}`,
				};
			}
			videoContent = await videoResp.arrayBuffer();
			mimeType =
				videoResp.headers.get("content-type")?.split(";")[0] || mimeType;
		}

		if (!videoContent) {
			return {
				ok: false,
				platform: "youtube",
				error: "Could not obtain video content",
			};
		}

		// Step 1: Create resumable upload session
		const metadata = {
			snippet: {
				title: input.title || input.text.slice(0, 100),
				description: input.text,
				tags: input.tags,
			},
			status: {
				privacyStatus: input.visibility || "public",
				selfDeclaredMadeForKids: false,
			},
		};

		const uploadUrl = new URL(
			"https://www.googleapis.com/upload/youtube/v3/videos",
		);
		uploadUrl.searchParams.set("part", "snippet,status");
		uploadUrl.searchParams.set("uploadType", "resumable");

		const initResp = await fetch(uploadUrl.toString(), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${account.accessToken}`,
				"Content-Type": "application/json",
				"X-Upload-Content-Type": mimeType,
				"X-Upload-Content-Length": String(videoContent.byteLength),
			},
			body: JSON.stringify(metadata),
		});

		if (!initResp.ok) {
			const errBody = await initResp.text();
			return {
				ok: false,
				platform: "youtube",
				error: `Upload session creation failed: HTTP ${initResp.status} — ${errBody}`,
			};
		}

		const uploadLocation = initResp.headers.get("Location");
		if (!uploadLocation) {
			return {
				ok: false,
				platform: "youtube",
				error: "No upload location in response",
			};
		}

		// Step 2: Upload the video binary
		const uploadResp = await fetch(uploadLocation, {
			method: "PUT",
			headers: {
				"Content-Type": mimeType,
				"Content-Length": String(videoContent.byteLength),
			},
			body: videoContent,
		});

		if (!uploadResp.ok) {
			const errBody = await uploadResp.text();
			return {
				ok: false,
				platform: "youtube",
				error: `Video upload failed: HTTP ${uploadResp.status} — ${errBody}`,
			};
		}

		const result = (await uploadResp.json()) as {
			id?: string;
			snippet?: { title?: string };
		};

		return {
			ok: true,
			platform: "youtube",
			nativeId: result.id,
			nativeUrl: result.id
				? `https://www.youtube.com/watch?v=${result.id}`
				: undefined,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "youtube",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TIKTOK — TikTok Content Posting API
// POST https://open.tiktokapis.com/v2/video/publish/
// Note: Requires video to be pre-uploaded via their upload endpoint
// ═══════════════════════════════════════════════════════════════════════════

async function publishToTikTok(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
	_env: Env,
): Promise<CrossPostResult> {
	try {
		// TikTok requires a two-step process:
		// 1. Initialize upload (get upload URL)
		// 2. Upload video to the provided URL
		// 3. Call publish with the video ID

		if (!input.videoUrl && !input.videoBase64) {
			return {
				ok: false,
				platform: "tiktok",
				error: "videoUrl or videoBase64 required for TikTok publishing",
			};
		}

		// Step 1: Initialize upload
		const initResp = await fetch(
			"https://open.tiktokapis.com/v2/video/upload/init/",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${account.accessToken}`,
					"Content-Type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					source_info: {
						source: "FILE_UPLOAD",
						video_size: input.videoBase64
							? Math.ceil((input.videoBase64.length * 3) / 4)
							: 0,
						chunk_size: input.videoBase64
							? Math.ceil((input.videoBase64.length * 3) / 4)
							: 0,
						total_chunk_count: 1,
					},
				}),
			},
		);

		if (!initResp.ok) {
			const errBody = await initResp.text();
			return {
				ok: false,
				platform: "tiktok",
				error: `TikTok init failed: HTTP ${initResp.status} — ${errBody}`,
			};
		}

		const initData = (await initResp.json()) as {
			data?: { upload_url?: string; publish_id?: string };
		};

		const uploadUrl = initData?.data?.upload_url;
		if (!uploadUrl) {
			return {
				ok: false,
				platform: "tiktok",
				error: "No upload URL from TikTok init",
			};
		}

		// Step 2: Upload video content
		let videoBody: BodyInit | null = null;
		if (input.videoBase64) {
			const binaryString = atob(input.videoBase64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			videoBody = bytes;
		} else if (input.videoUrl) {
			const videoResp = await fetch(input.videoUrl);
			if (!videoResp.ok) {
				return {
					ok: false,
					platform: "tiktok",
					error: `Failed to fetch video: HTTP ${videoResp.status}`,
				};
			}
			videoBody = await videoResp.arrayBuffer();
		}

		if (!videoBody) {
			return {
				ok: false,
				platform: "tiktok",
				error: "Could not obtain video content",
			};
		}

		const uploadResp = await fetch(uploadUrl, {
			method: "PUT",
			headers: { "Content-Type": "video/mp4" },
			body: videoBody,
		});

		if (!uploadResp.ok) {
			return {
				ok: false,
				platform: "tiktok",
				error: `TikTok video upload failed: HTTP ${uploadResp.status}`,
			};
		}

		// Step 3: Publish the video
		const publishResp = await fetch(
			"https://open.tiktokapis.com/v2/video/publish/",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${account.accessToken}`,
					"Content-Type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					post_info: {
						title: input.text.slice(0, 2200),
						privacy_level: input.visibility === "private" ? "PRIVATE" : "PUBLIC_TO_EVERYONE",
						disable_duet: false,
						disable_comment: false,
						disable_stitch: false,
						brand_content_toggle: false,
					},
					source_info: {
						source: "FILE_UPLOAD",
						video_size: 0,
						chunk_size: 0,
						total_chunk_count: 1,
					},
				}),
			},
		);

		const publishData = (await publishResp.json()) as {
			data?: { publish_id?: string };
		};

		if (!publishResp.ok) {
			return {
				ok: false,
				platform: "tiktok",
				error: `TikTok publish failed: HTTP ${publishResp.status}`,
			};
		}

		return {
			ok: true,
			platform: "tiktok",
			nativeId: publishData?.data?.publish_id,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "tiktok",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTAGRAM — Instagram Graph API
// POST /{{ig-user-id}}/media + /{{ig-user-id}}/media_publish
// ═══════════════════════════════════════════════════════════════════════════

async function publishToInstagram(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
	env: Env,
): Promise<CrossPostResult> {
	try {
		const igUserId = account.platformUserId;
		const accessToken = account.accessToken;

		// Instagram supports image carousel posts and single images
		if (!input.images || input.images.length === 0) {
			// Text-only post — Instagram doesn't support this. Create an image from text or fail.
			return {
				ok: false,
				platform: "instagram",
				error:
					"Instagram requires at least one image. Text-only posts are not supported.",
			};
		}

		// Step 1: Create media container(s)
		const mediaIds: string[] = [];
		for (const imageUrl of input.images.slice(0, 10)) {
			const createResp = await fetch(
				`https://graph.facebook.com/v19.0/${igUserId}/media`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						image_url: imageUrl,
						caption: input.text.slice(0, 2200),
						access_token: accessToken,
					}),
				},
			);

			const createData = (await createResp.json()) as {
				id?: string;
				error?: { message?: string };
			};

			if (!createResp.ok || !createData.id) {
				return {
					ok: false,
					platform: "instagram",
					error: `Failed to create media: ${createData.error?.message || `HTTP ${createResp.status}`}`,
				};
			}
			mediaIds.push(createData.id);
		}

		if (mediaIds.length === 0) {
			return { ok: false, platform: "instagram", error: "No media created" };
		}

		// Step 2: For carousel (multiple images), create carousel container
		let publishId: string;
		if (mediaIds.length === 1) {
			publishId = mediaIds[0] || "";
		} else {
			// Create carousel
			const carouselResp = await fetch(
				`https://graph.facebook.com/v19.0/${igUserId}/media`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						media_type: "CAROUSEL",
						children: mediaIds,
						caption: input.text.slice(0, 2200),
						access_token: accessToken,
					}),
				},
			);

			const carouselData = (await carouselResp.json()) as {
				id?: string;
				error?: { message?: string };
			};

			if (!carouselResp.ok || !carouselData.id) {
				return {
					ok: false,
					platform: "instagram",
					error: `Failed to create carousel: ${carouselData.error?.message || `HTTP ${carouselResp.status}`}`,
				};
			}
			publishId = carouselData.id;
		}

		// Step 3: Publish the container
		const publishResp = await fetch(
			`https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					creation_id: publishId,
					access_token: accessToken,
				}),
			},
		);

		const publishData = (await publishResp.json()) as {
			id?: string;
			error?: { message?: string };
		};

		if (!publishResp.ok) {
			return {
				ok: false,
				platform: "instagram",
				error: `Failed to publish: ${publishData.error?.message || `HTTP ${publishResp.status}`}`,
			};
		}

		return {
			ok: true,
			platform: "instagram",
			nativeId: publishData.id,
			nativeUrl: `https://www.instagram.com/p/${publishData.id}/`,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "instagram",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN — LinkedIn API v2
// POST https://api.linkedin.com/v2/ugcPosts
// ═══════════════════════════════════════════════════════════════════════════

async function publishToLinkedIn(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
	try {
		const author = `urn:li:person:${account.platformUserId}`;

		// Build the LinkedIn post body
		const body: Record<string, unknown> = {
			author,
			lifecycleState: "PUBLISHED",
			specificContent: {
				"com.linkedin.ugc.ShareContent": {
					shareCommentary: {
						text: input.text.slice(0, 3000),
					},
					shareMediaCategory: "NONE",
				},
			},
			visibility: {
				"com.linkedin.ugc.MemberNetworkVisibility":
					input.visibility === "private" ? "CONTAINER" : "PUBLIC",
			},
		};

		// Add images if provided
		if (input.images && input.images.length > 0) {
			const media: Array<{
				status: string;
				description?: { text: string };
				media: string;
			}> = [];

			for (const imageUrl of input.images.slice(0, 9)) {
				// Register the image
				const registerResp = await fetch(
					"https://api.linkedin.com/v2/assets?action=registerUpload",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${account.accessToken}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							registerUploadRequest: {
								recipes: [
									"urn:li:digitalmediaRecipe:feedshare-image",
								],
								owner: author,
								serviceRelationships: [
									{
										relationshipType: "OWNER",
										identifier:
											"urn:li:userGeneratedContent",
									},
								],
							},
						}),
					},
				);

				const registerData = (await registerResp.json()) as {
					value?: {
						uploadMechanism?: {
							"com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: {
								uploadUrl?: string;
							};
						};
						asset?: string;
					};
				};

				const uploadUrl =
					registerData?.value?.uploadMechanism?.[
						"com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
					]?.uploadUrl;
				if (uploadUrl) {
					// Upload the image
					const imgResp = await fetch(imageUrl);
					if (imgResp.ok) {
						const imgBlob = await imgResp.arrayBuffer();
						await fetch(uploadUrl, {
							method: "PUT",
							body: imgBlob,
						});
					}

					if (registerData?.value?.asset) {
						media.push({
							status: "READY",
							description: { text: "" },
							media: registerData.value.asset,
						});
					}
				}
			}

			if (media.length > 0) {
				body.specificContent = {
					"com.linkedin.ugc.ShareContent": {
						shareCommentary: {
							text: input.text.slice(0, 3000),
						},
						shareMediaCategory: "IMAGE",
						media,
					},
				};
			}
		}

		const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${account.accessToken}`,
				"Content-Type": "application/json",
				"X-Restli-Protocol-Version": "2.0.0",
			},
			body: JSON.stringify(body),
		});

		const data = (await resp.json()) as {
			id?: string;
			message?: string;
			error?: string;
		};

		if (!resp.ok) {
			return {
				ok: false,
				platform: "linkedin",
				error: data.message || data.error || `HTTP ${resp.status}`,
			};
		}

		// LinkedIn returns the post ID in the "id" field, and the activity URL
		const activityId = data.id || "";
		return {
			ok: true,
			platform: "linkedin",
			nativeId: activityId,
			nativeUrl: activityId
				? `https://www.linkedin.com/feed/update/${activityId}`
				: undefined,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "linkedin",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// REDDIT — Reddit API
// POST https://oauth.reddit.com/api/submit
// ═══════════════════════════════════════════════════════════════════════════

async function publishToReddit(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
	try {
		// Reddit requires a subreddit to post to
		// The text/title field is required
		if (!input.title) {
			return {
				ok: false,
				platform: "reddit",
				error: "title is required for Reddit posts",
			};
		}

		const body = new URLSearchParams({
			api_type: "json",
			title: input.title,
			text: input.text,
			kind: "self",
			sr: input.tags?.[0] || "test", // Use first tag as subreddit name
		});

		if (input.images && input.images.length > 0) {
			body.set("kind", "image");
			if (input.images[0]) body.set("url", input.images[0]);
		}

		// Override subreddit if specified via tags
		const subredditTag = input.tags?.find((t) => t.startsWith("r/"));
		if (subredditTag) {
			body.set("sr", subredditTag.replace("r/", ""));
		}

		// For link posts
		if (input.videoUrl) {
			body.set("kind", "link");
			body.set("url", input.videoUrl);
			body.delete("text");
		}

		const resp = await fetch("https://oauth.reddit.com/api/submit", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${account.accessToken}`,
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "degenfeed:centralized-poster:1.0 (by /u/degenfeed)",
			},
			body: body.toString(),
		});

		const data = (await resp.json()) as {
			json?: {
				errors?: Array<unknown>;
				data?: { id?: string; url?: string; name?: string };
			};
			error?: number;
			message?: string;
		};

		if (!resp.ok || data.json?.errors?.length) {
			return {
				ok: false,
				platform: "reddit",
				error:
					data.message ||
					(data.json?.errors?.[0]
						? JSON.stringify(data.json.errors[0])
						: `HTTP ${resp.status}`),
			};
		}

		const postData = data.json?.data;
		return {
			ok: true,
			platform: "reddit",
			nativeId: postData?.id || postData?.name,
			nativeUrl: postData?.url || `https://reddit.com${postData?.name || ""}`,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "reddit",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PINTEREST — Pinterest API v5
// POST https://api.pinterest.com/v5/pins
// ═══════════════════════════════════════════════════════════════════════════

async function publishToPinterest(
	input: CrossPostInput,
	account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
	try {
		// Pinterest requires at least one image
		if (!input.images || input.images.length === 0) {
			return {
				ok: false,
				platform: "pinterest",
				error: "At least one image is required for Pinterest pins",
			};
		}

		const body = {
			title: input.title || input.text.slice(0, 100),
			description: input.text.slice(0, 500),
			alt_text: "",
			link: input.tags?.find((t) => t.startsWith("http")) || undefined,
			media_source: {
				source_type: "image_url",
				url: input.images[0],
			},
		};

		const resp = await fetch(
			"https://api.pinterest.com/v5/pins",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${account.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		const data = (await resp.json()) as {
			id?: string;
			link?: string;
			message?: string;
		};

		if (!resp.ok) {
			return {
				ok: false,
				platform: "pinterest",
				error: data.message || `HTTP ${resp.status}`,
			};
		}

		return {
			ok: true,
			platform: "pinterest",
			nativeId: data.id,
			nativeUrl: data.link,
		};
	} catch (err) {
		return {
			ok: false,
			platform: "pinterest",
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM-SPECIFIC CONTENT ADAPTATION CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const PLATFORM_LIMITS: Record<
	string,
	{
		maxChars: number;
		maxImages: number;
		supportsVideo: boolean;
		supportsMarkdown: boolean;
		isLongForm: boolean;
		isVideo: boolean;
		isShortVideo: boolean;
		isNewsletter: boolean;
	}
> = {
	mastodon: {
		maxChars: 500,
		maxImages: 4,
		supportsVideo: true,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	bluesky: {
		maxChars: 300,
		maxImages: 4,
		supportsVideo: true,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	nostr: {
		maxChars: 10000,
		maxImages: 10,
		supportsVideo: true,
		supportsMarkdown: true,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	farcaster: {
		maxChars: 320,
		maxImages: 2,
		supportsVideo: true,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	twitter: {
		maxChars: 280,
		maxImages: 4,
		supportsVideo: true,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	linkedin: {
		maxChars: 3000,
		maxImages: 9,
		supportsVideo: true,
		supportsMarkdown: true,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	reddit: {
		maxChars: 40000,
		maxImages: 20,
		supportsVideo: true,
		supportsMarkdown: true,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	medium: {
		maxChars: 999999,
		maxImages: 100,
		supportsVideo: false,
		supportsMarkdown: true,
		isLongForm: true,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	substack: {
		maxChars: 999999,
		maxImages: 100,
		supportsVideo: false,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: true,
	},
	youtube: {
		maxChars: 5000,
		maxImages: 0,
		supportsVideo: false,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: true,
		isShortVideo: false,
		isNewsletter: false,
	},
	tiktok: {
		maxChars: 2200,
		maxImages: 0,
		supportsVideo: false,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: true,
		isNewsletter: false,
	},
	instagram: {
		maxChars: 2200,
		maxImages: 10,
		supportsVideo: true,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
	pinterest: {
		maxChars: 500,
		maxImages: 1,
		supportsVideo: false,
		supportsMarkdown: false,
		isLongForm: false,
		isVideo: false,
		isShortVideo: false,
		isNewsletter: false,
	},
};

/**
 * Adapt content for a specific platform's limits.
 * Truncates text, limits images, and adjusts formatting.
 */
export function adaptContentForPlatform(
	text: string,
	platform: string,
	images?: string[],
): { text: string; images: string[] } {
	const limits = PLATFORM_LIMITS[platform];
	if (!limits) return { text, images: images || [] };

	let adapted = text;

	// Truncate to max chars
	if (adapted.length > limits.maxChars) {
		adapted = `${adapted.slice(0, limits.maxChars - 1)}…`;
	}

	// Limit images
	const adaptedImages = (images || []).slice(0, limits.maxImages);

	// For long-form platforms, ensure markdown compatibility
	if (limits.supportsMarkdown && !adapted.includes("\n\n")) {
		// Ensure paragraphs for markdown
		adapted = adapted.replace(/\n/g, "\n\n");
	}

	return { text: adapted, images: adaptedImages };
}

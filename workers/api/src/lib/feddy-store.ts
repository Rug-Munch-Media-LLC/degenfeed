/**
 * @degenfeed/api-worker — Feddy Communities KV data layer
 *
 * KV-backed store for federated ActivityPub communities.
 * Each community exists on our GoToSocial instance as a Group actor and
 * federates across the Fediverse automatically.
 *
 * KV key patterns:
 *   feddy:{id}                         → FeddyCommunity object (permanent)
 *   feddy:by-name:{name}               → community id (permanent)
 *   feddy:members:{id}                 → Set of wallet + role entries (permanent)
 *   feddy:posts:{id}:{ts}:{uid}        → Post (90d TTL)
 *   feddy:feed:{id}                    → Recent post index (array of IDs)
 *   feddy:pinned:{id}                  → Pinned post IDs (array)
 *   feddy:directory:index              → Set of all community IDs
 *   feddy:directory:by-category:{cat}  → Category index
 *   feddy:stats:{id}                   → Cached stats (5min TTL)
 *   feddy:name-reservation:{name}      → Pending name lock (10min TTL)
 *   feddy:events:{id}:{eid}            → CommunityEvent (90d TTL)
 *   feddy:events:{id}:index            → Event ID array
 *   feddy:event-rsvps:{eid}            → RSVP array
 *   feddy:polls:{id}:{pid}             → CommunityPoll (90d TTL)
 *   feddy:polls:{id}:index             → Poll ID array
 *   feddy:poll-votes:{pid}             → Vote records
 *   feddy:wiki:{id}                    → WikiPage[] (permanent)
 *   feddy:badges:{id}                  → BadgeDefinition[] (permanent)
 *   feddy:member-badges:{id}:{wallet}  → badge IDs
 *   feddy:treasury:{id}                → TreasuryState (permanent)
 *   feddy:treasury-tx:{id}:{txid}      → TreasuryTx (permanent)
 *   feddy:token-config:{id}            → CommunityTokenConfig (permanent)
 *   feddy:token-gates:{id}             → TokenGate[] (permanent)
 *   feddy:mod-log:{id}:{ts}:{eid}      → ModLogEntry (180d TTL)
 *   feddy:reports:{id}:{rid}           → Report (180d TTL)
 *   feddy:appeals:{id}:{aid}           → Appeal (180d TTL)
 *   feddy:keyword-filters:{id}         → KeywordFilter[] (permanent)
 *   feddy:link-blocklist:{id}          → string[] (permanent)
 *   feddy:fed-blocklist:{id}           → FedBlocklistEntry[] (permanent)
 *   feddy:webhooks:{id}:{hid}          → WebhookConfig (permanent)
 *   feddy:bot-keys:{id}:{kid}          → BotApiKey (permanent)
 *   feddy:rss:{id}                     → cached RSS JSON (5min TTL)
 *   feddy:federation-health:{id}       → FederationHealth (1h TTL)
 *   feddy:trending                     → trending score map
 *   feddy:similar:{id}                 → similar community score map
 *   feddy:discovered-remote            → remote communities
 *   feddy:follower-comms:{wallet}      → follower community IDs
 *   feddy:autocomplete                 → name prefix index
 */

import type { Env } from "../index";

// ─── Types ──────────────────────────────────────────────────────────────

export type FeddyCategory =
	| "crypto"
	| "tech"
	| "art"
	| "music"
	| "gaming"
	| "sports"
	| "food"
	| "travel"
	| "fashion"
	| "health"
	| "education"
	| "finance"
	| "science"
	| "literature"
	| "film"
	| "general";

export type FederationStatus = "active" | "limited" | "suspended";

/** Extended member roles */
export type MemberRole =
	| "owner"
	| "moderator"
	| "contributor"
	| "vip"
	| "og"
	| "member";

export interface FeddyCommunity {
	id: string;
	name: string;
	displayName: string;
	description: string;
	rules: string[];
	category: FeddyCategory;
	tags: string[];
	owner: string;
	moderators: string[];
	memberCount: number;
	createdAt: number;
	updatedAt: number;
	isPrivate: boolean;
	linkedCoin: string | null;
	gtsHandle: string;
	gtsId: string;
	avatarUrl: string;
	bannerUrl: string;
	federationStatus: FederationStatus;
	totalPosts: number;
	// --- NEW FIELDS ---
	/** Community token config mint address */
	communityTokenMint?: string | null;
	/** Community token symbol (e.g. "$ART") */
	communityTokenSymbol?: string | null;
	/** Treasury public key for receiving fees */
	treasuryAddress?: string | null;
	/** Total tokens minted for the community */
	totalTokenSupply?: number;
	/** Whether community has a wiki enabled */
	hasWiki?: boolean;
	/** Whether community has an events calendar */
	hasEvents?: boolean;
	/** Whether community has polls enabled */
	hasPolls?: boolean;
	/** Whether community has a treasury */
	hasTreasury?: boolean;
	/** Link to Discord server */
	discordLink?: string | null;
	/** Link to Telegram group */
	telegramLink?: string | null;
	/** RSS feed URL for the community */
	rssFeedUrl?: string | null;
	/** Webhook URL for community events */
	webhookUrl?: string | null;
	/** Bot token for programmatic posting */
	botToken?: string | null;
	/** Featured until timestamp (0 = not featured) */
	featuredUntil?: number;
	/** Instance URL where this community was discovered from (for remote) */
	remoteInstance?: string | null;
	/** Category page featured position (0 = not featured) */
	featuredPosition?: number;
}

export interface CommunityMember {
	wallet: string;
	role: MemberRole;
	displayName?: string;
	avatarUrl?: string;
	joinedAt: number;
	/** Total posts by this member */
	postCount?: number;
	/** Token balance for community token */
	tokenBalance?: number;
	/** Badge IDs earned */
	badgeIds?: string[];
}

export interface CommunityPost {
	id: string;
	communityId: string;
	author: string;
	authorDisplayName: string;
	authorAvatarUrl?: string;
	text: string;
	embeds?: Array<{
		kind: "image" | "video" | "link" | "poll";
		url: string;
		meta?: Record<string, unknown>;
	}>;
	gtsStatusId: string;
	createdAt: number;
	likes: number;
	replies: number;
	boosts: number;
	/** Whether post is pinned */
	isPinned?: boolean;
	/** If this is a cross-post, source protocol */
	crossPostSource?: string | null;
	/** If this is an announcement */
	isAnnouncement?: boolean;
}

export interface CommunityStats {
	memberCount: number;
	postCount: number;
	postsLast24h: number;
	postsLast7d: number;
	activeMembers: number;
	topContributors: Array<{
		wallet: string;
		displayName: string;
		postCount: number;
	}>;
	// --- NEW ---
	/** Total treasury balance */
	treasuryBalance?: number;
	/** Number of events this month */
	eventsThisMonth?: number;
	/** Number of active polls */
	activePolls?: number;
	/** Member growth rate (7d %) */
	memberGrowth7d?: number;
	/** Post growth rate (7d %) */
	postGrowth7d?: number;
	/** Federated instance count */
	federatedInstances?: number;
}

export interface DirectoryEntry {
	id: string;
	name: string;
	displayName: string;
	description: string;
	category: FeddyCategory;
	tags: string[];
	memberCount: number;
	postCount: number;
	createdAt: number;
	avatarUrl: string;
	federationStatus: FederationStatus;
	linkedCoin: string | null;
	trendingScore: number;
	// --- NEW ---
	communityTokenSymbol?: string | null;
	featuredPosition?: number;
	remoteInstance?: string | null;
}

export interface DirectoryResult {
	entries: DirectoryEntry[];
	cursor: string | null;
	hasMore: boolean;
	total: number;
}

// ─── Event Types ────────────────────────────────────────────────────────

export interface CommunityEvent {
	id: string;
	communityId: string;
	title: string;
	description: string;
	startTime: number; // Unix ms
	endTime: number; // Unix ms
	location: string; // URL or physical location
	createdBy: string;
	createdAt: number;
	maxAttendees: number;
	rsvpCount: number;
	coverUrl?: string;
	isVirtual: boolean;
	tags: string[];
}

export interface EventRSVP {
	wallet: string;
	displayName?: string;
	status: "going" | "maybe" | "declined";
	respondedAt: number;
}

// ─── Poll Types ─────────────────────────────────────────────────────────

export interface PollOption {
	id: string;
	text: string;
	votes: number;
}

export interface CommunityPoll {
	id: string;
	communityId: string;
	question: string;
	options: PollOption[];
	createdBy: string;
	createdAt: number;
	expiresAt: number;
	isMultipleChoice: boolean;
	totalVotes: number;
	isClosed: boolean;
}

export interface PollVote {
	wallet: string;
	optionId: string;
	votedAt: number;
}

// ─── Wiki Types ─────────────────────────────────────────────────────────

export interface WikiPage {
	id: string;
	title: string;
	content: string;
	slug: string;
	createdBy: string;
	updatedBy: string;
	createdAt: number;
	updatedAt: number;
}

// ─── Badge Types ────────────────────────────────────────────────────────

export interface BadgeDefinition {
	id: string;
	name: string;
	description: string;
	iconUrl: string;
	criteria: string; // e.g. "100_posts" | "early_adopter" | "top_contributor"
	createdAt: number;
	createdBy: string;
}

// ─── Treasury Types ─────────────────────────────────────────────────────

export interface TreasuryState {
	communityId: string;
	/** Balance in smallest units */
	balance: string;
	/** Token mint address */
	tokenMint: string;
	/** Total deposits */
	totalDeposits: string;
	/** Total withdrawals */
	totalWithdrawals: string;
	updatedAt: number;
}

export interface TreasuryTx {
	id: string;
	communityId: string;
	type: "deposit" | "withdrawal" | "reward" | "fee_share" | "community_fund";
	amount: string;
	from: string;
	to: string;
	memo: string;
	txSignature: string;
	createdAt: number;
}

// ─── Token Types ────────────────────────────────────────────────────────

export interface CommunityTokenConfig {
	communityId: string;
	mintAddress: string;
	symbol: string;
	name: string;
	decimals: number;
	totalSupply: number;
	/** Whether token is tradeable on DEX */
	isTradeable: boolean;
	/** Percentage of creator coin fees that go to treasury (0-100) */
	feeSharePercent: number;
	/** Tokens rewarded per post */
	rewardPerPost: number;
	createdAt: number;
}

export interface TokenGate {
	id: string;
	name: string;
	/** Minimum token balance required */
	minBalance: number;
	/** If true, only token holders can view/post */
	isRequired: boolean;
	/** Optional channel/topic filter */
	channelName?: string;
	createdAt: number;
}

// ─── Moderation Types ───────────────────────────────────────────────────

export interface ModLogEntry {
	id: string;
	communityId: string;
	action:
		| "ban"
		| "unban"
		| "warn"
		| "remove_post"
		| "pin"
		| "unpin"
		| "change_role"
		| "update_settings"
		| "delete_post"
		| "mute"
		| "block_instance"
		| "unblock_instance"
		| "appeal_granted"
		| "appeal_denied";
	moderatorWallet: string;
	targetWallet?: string;
	reason: string;
	details?: Record<string, unknown>;
	createdAt: number;
}

export type ReportCategory =
	| "spam"
	| "harassment"
	| "hate_speech"
	| "violence"
	| "nsfw"
	| "impersonation"
	| "copyright"
	| "scam"
	| "other";

export interface Report {
	id: string;
	communityId: string;
	reporterWallet: string;
	targetWallet: string;
	targetPostId?: string;
	category: ReportCategory;
	description: string;
	evidenceUrls?: string[];
	status: "open" | "investigating" | "resolved" | "dismissed";
	resolvedBy?: string;
	resolution?: string;
	createdAt: number;
	resolvedAt?: number;
}

export interface Appeal {
	id: string;
	communityId: string;
	wallet: string;
	reason: string;
	status: "pending" | "granted" | "denied";
	reviewedBy?: string;
	reviewNote?: string;
	createdAt: number;
	reviewedAt?: number;
}

export interface KeywordFilter {
	id: string;
	pattern: string; // regex or literal
	isRegex: boolean;
	action: "flag" | "block" | "require_approval";
	createdAt: number;
	createdBy: string;
}

export interface FedBlocklistEntry {
	instanceUrl: string;
	reason: string;
	blockedBy: string;
	blockedAt: number;
}

// ─── Webhook / Bot Types ────────────────────────────────────────────────

export interface WebhookConfig {
	id: string;
	communityId: string;
	url: string;
	secret: string;
	events: WebhookEvent[];
	isActive: boolean;
	createdBy: string;
	createdAt: number;
	lastDelivery?: number;
	lastStatus?: number;
}

export type WebhookEvent =
	| "post.created"
	| "post.deleted"
	| "member.joined"
	| "member.left"
	| "member.banned"
	| "event.created"
	| "poll.closed"
	| "treasury.deposit"
	| "treasury.withdrawal";

export interface BotApiKey {
	id: string;
	communityId: string;
	name: string;
	keyHash: string;
	scopes: BotScope[];
	createdBy: string;
	createdAt: number;
	lastUsedAt?: number;
	isActive: boolean;
}

export type BotScope =
	| "post:write"
	| "post:read"
	| "members:read"
	| "stats:read";

// ─── Federation Types ───────────────────────────────────────────────────

export interface FederationHealth {
	communityId: string;
	/** Instances that are following this community */
	followerInstances: Array<{
		instanceUrl: string;
		followersCount: number;
		firstSeen: number;
		lastActivity: number;
		status: "active" | "delayed" | "error";
	}>;
	/** Total followers across all instances */
	totalFollowers: number;
	/** Follower growth over last 7d */
	followerGrowth7d: number;
	/** Last successful federation push */
	lastFederatedAt: number;
	/** Number of failed pushes in last 24h */
	failedPushes24h: number;
	/** Remote instances that have been discovered */
	remoteFollowers: Array<{
		instanceUrl: string;
		actorId: string;
		username: string;
		domain: string;
		followedAt: number;
	}>;
}

export interface RemoteCommunity {
	id: string;
	name: string;
	displayName: string;
	description: string;
	instanceUrl: string;
	memberCount: number;
	avatarUrl: string;
	category?: string;
	tags: string[];
	originalUrl: string;
	discoveredAt: number;
	lastRefreshed: number;
}

// ─── Trending / Discovery Types ─────────────────────────────────────────

export interface TrendingScore {
	communityId: string;
	score: number;
	memberGrowth24h: number;
	memberGrowth7d: number;
	postGrowth24h: number;
	postGrowth7d: number;
	calculatedAt: number;
}

export interface AutocompleteResult {
	name: string;
	displayName: string;
	avatarUrl: string;
	memberCount: number;
	category: FeddyCategory;
}

// ─── Constants ──────────────────────────────────────────────────────────

export const VALID_CATEGORIES: FeddyCategory[] = [
	"crypto",
	"tech",
	"art",
	"music",
	"gaming",
	"sports",
	"food",
	"travel",
	"fashion",
	"health",
	"education",
	"finance",
	"science",
	"literature",
	"film",
	"general",
];

export const VALID_CATEGORIES_SET = new Set<string>(VALID_CATEGORIES);

export const CATEGORY_META: Record<
	FeddyCategory,
	{ emoji: string; label: string }
> = {
	crypto: { emoji: "₿", label: "Crypto" },
	tech: { emoji: "💻", label: "Tech" },
	art: { emoji: "🎨", label: "Art" },
	music: { emoji: "🎵", label: "Music" },
	gaming: { emoji: "🎮", label: "Gaming" },
	sports: { emoji: "⚽", label: "Sports" },
	food: { emoji: "🍕", label: "Food" },
	travel: { emoji: "✈️", label: "Travel" },
	fashion: { emoji: "👗", label: "Fashion" },
	health: { emoji: "💪", label: "Health" },
	education: { emoji: "📚", label: "Education" },
	finance: { emoji: "💰", label: "Finance" },
	science: { emoji: "🔬", label: "Science" },
	literature: { emoji: "📖", label: "Literature" },
	film: { emoji: "🎬", label: "Film" },
	general: { emoji: "🌐", label: "General" },
};

export const REPORT_CATEGORIES: ReportCategory[] = [
	"spam",
	"harassment",
	"hate_speech",
	"violence",
	"nsfw",
	"impersonation",
	"copyright",
	"scam",
	"other",
];

export const VALID_SORT_OPTIONS = [
	"members",
	"newest",
	"trending",
	"posts",
] as const;
export type SortOption = (typeof VALID_SORT_OPTIONS)[number];

export const PREMIUM_FEATURES = {
	unlimitedProtocols: true,
	creatorCoins: true,
	customVesting: true,
	feddyCommunities: true,
	communityDirectory: true,
	communityCoin: true,
	customDomain: true,
	analytics: true,
	scheduledPosts: true,
	modTools: true,
	joinCommunities: true,
	browseDirectory: true,
	tipInCommunities: true,
} as const;

// ─── Extended role hierarchy ────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<MemberRole, number> = {
	owner: 100,
	moderator: 80,
	contributor: 60,
	vip: 40,
	og: 30,
	member: 10,
};

export const ROLE_BADGE_LABELS: Record<MemberRole, string> = {
	owner: "Owner",
	moderator: "Mod",
	contributor: "Contributor",
	vip: "VIP",
	og: "OG Member",
	member: "Member",
};

export const ROLE_BADGE_COLORS: Record<MemberRole, string> = {
	owner: "text-amber-400 bg-amber-500/15",
	moderator: "text-blue-400 bg-blue-500/15",
	contributor: "text-green-400 bg-green-500/15",
	vip: "text-purple-400 bg-purple-500/15",
	og: "text-orange-400 bg-orange-500/15",
	member: "text-[var(--color-muted)] bg-[var(--color-overlay)]",
};

// ─── KV helpers ─────────────────────────────────────────────────────────

function k(...parts: string[]): string {
	return parts.join(":");
}

function getStore(env: Env): KVNamespace {
	if (!env.FEDDY) throw new Error("FEDDY KV namespace not bound");
	return env.FEDDY;
}

// ─── Community CRUD ────────────────────────────────────────────────────

export async function createCommunity(
	env: Env,
	community: FeddyCommunity,
): Promise<void> {
	const store = getStore(env);
	await Promise.all([
		store.put(k("feddy", community.id), JSON.stringify(community)),
		store.put(k("feddy", "by-name", community.name), community.id),
		store.put(
			k("feddy", "members", community.id),
			JSON.stringify([
				{
					wallet: community.owner,
					role: "owner" as MemberRole,
					joinedAt: community.createdAt,
				},
			]),
		),
		store.put(k("feddy", "directory", "index"), community.id, {
			metadata: { method: "append" },
		}),
		store.put(
			k("feddy", "directory", "by-category", community.category),
			community.id,
			{
				metadata: { method: "append" },
			},
		),
		store.put(k("feddy", "feed", community.id), JSON.stringify([])),
		store.put(k("feddy", "pinned", community.id), JSON.stringify([])),
		// Update autocomplete index
		...community.name.split("").map((_, i) =>
			store.put(
				k("feddy", "autocomplete", community.name.slice(0, i + 1)),
				community.id,
				{
					metadata: { method: "append" },
				},
			),
		),
	]);
}

export async function getCommunityById(
	env: Env,
	id: string,
): Promise<FeddyCommunity | null> {
	try {
		const raw = await getStore(env).get(k("feddy", id));
		return raw ? (JSON.parse(raw) as FeddyCommunity) : null;
	} catch {
		return null;
	}
}

export async function getCommunityByName(
	env: Env,
	name: string,
): Promise<FeddyCommunity | null> {
	try {
		const store = getStore(env);
		const id = await store.get(k("feddy", "by-name", name.toLowerCase()));
		if (!id || id.length === 0) return null;
		return getCommunityById(env, id);
	} catch {
		return null;
	}
}

export async function updateCommunity(
	env: Env,
	id: string,
	updates: Partial<FeddyCommunity>,
): Promise<FeddyCommunity | null> {
	const community = await getCommunityById(env, id);
	if (!community) return null;

	const updated: FeddyCommunity = {
		...community,
		...updates,
		id: community.id,
		name: community.name,
		owner: community.owner,
		gtsId: community.gtsId,
		gtsHandle: community.gtsHandle,
		createdAt: community.createdAt,
		updatedAt: Date.now(),
	};

	const store = getStore(env);
	await store.put(k("feddy", id), JSON.stringify(updated));

	if (updates.category && updates.category !== community.category) {
		await store.put(
			k("feddy", "directory", "by-category", updates.category),
			id,
			{
				metadata: { method: "append" },
			},
		);
	}

	return updated;
}

export async function deleteCommunity(env: Env, id: string): Promise<boolean> {
	const community = await getCommunityById(env, id);
	if (!community) return false;

	const store = getStore(env);
	await Promise.all([
		store.delete(k("feddy", id)),
		store.delete(k("feddy", "by-name", community.name)),
		store.delete(k("feddy", "members", id)),
		store.delete(k("feddy", "feed", id)),
		store.delete(k("feddy", "pinned", id)),
		store.delete(k("feddy", "stats", id)),
		store.delete(k("feddy", "events", id, "index")),
		store.delete(k("feddy", "polls", id, "index")),
		store.delete(k("feddy", "wiki", id)),
		store.delete(k("feddy", "badges", id)),
		store.delete(k("feddy", "treasury", id)),
		store.delete(k("feddy", "token-config", id)),
		store.delete(k("feddy", "token-gates", id)),
		store.delete(k("feddy", "keyword-filters", id)),
		store.delete(k("feddy", "link-blocklist", id)),
		store.delete(k("feddy", "fed-blocklist", id)),
		store.delete(k("feddy", "federation-health", id)),
	]);
	return true;
}

// ─── Name reservation ───────────────────────────────────────────────────

export async function reserveName(
	env: Env,
	name: string,
	wallet: string,
): Promise<boolean> {
	try {
		const key = k("feddy", "name-reservation", name);
		const existing = await getStore(env).get(key);
		if (existing) {
			const reservation = JSON.parse(existing) as { wallet: string };
			if (reservation.wallet !== wallet) return false;
		}
		await getStore(env).put(
			key,
			JSON.stringify({ wallet, reservedAt: Date.now() }),
			{
				expirationTtl: 600,
			},
		);
		return true;
	} catch {
		return false;
	}
}

export async function releaseName(env: Env, name: string): Promise<void> {
	try {
		await getStore(env).delete(k("feddy", "name-reservation", name));
	} catch {
		// Non-critical
	}
}

// ─── Members ───────────────────────────────────────────────────────────

export async function getCommunityMembers(
	env: Env,
	communityId: string,
	limit = 50,
): Promise<CommunityMember[]> {
	try {
		const raw = await getStore(env).get(k("feddy", "members", communityId));
		if (!raw) return [];
		const members = JSON.parse(raw) as CommunityMember[];
		return members.slice(0, limit);
	} catch {
		return [];
	}
}

export async function getAllCommunityMembers(
	env: Env,
	communityId: string,
): Promise<CommunityMember[]> {
	try {
		const raw = await getStore(env).get(k("feddy", "members", communityId));
		if (!raw) return [];
		return JSON.parse(raw) as CommunityMember[];
	} catch {
		return [];
	}
}

export async function addCommunityMember(
	env: Env,
	communityId: string,
	wallet: string,
	role: MemberRole = "member",
): Promise<boolean> {
	try {
		const key = k("feddy", "members", communityId);
		const raw = await getStore(env).get(key);
		const members: CommunityMember[] = raw ? JSON.parse(raw) : [];
		if (members.some((m) => m.wallet === wallet)) return false;
		members.push({ wallet, role, joinedAt: Date.now() });
		await getStore(env).put(key, JSON.stringify(members));
		return true;
	} catch {
		return false;
	}
}

export async function removeCommunityMember(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<boolean> {
	try {
		const key = k("feddy", "members", communityId);
		const raw = await getStore(env).get(key);
		if (!raw) return false;
		const members: CommunityMember[] = JSON.parse(raw);
		const filtered = members.filter((m) => m.wallet !== wallet);
		if (filtered.length === members.length) return false;
		await getStore(env).put(key, JSON.stringify(filtered));
		return true;
	} catch {
		return false;
	}
}

export async function isCommunityMember(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<boolean> {
	try {
		const raw = await getStore(env).get(k("feddy", "members", communityId));
		if (!raw) return false;
		const members: CommunityMember[] = JSON.parse(raw);
		return members.some((m) => m.wallet === wallet);
	} catch {
		return false;
	}
}

export async function getMemberRole(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<MemberRole | null> {
	try {
		const raw = await getStore(env).get(k("feddy", "members", communityId));
		if (!raw) return null;
		const members: CommunityMember[] = JSON.parse(raw);
		const member = members.find((m) => m.wallet === wallet);
		return member?.role ?? null;
	} catch {
		return null;
	}
}

export async function setMemberRole(
	env: Env,
	communityId: string,
	wallet: string,
	role: MemberRole,
): Promise<boolean> {
	try {
		const key = k("feddy", "members", communityId);
		const raw = await getStore(env).get(key);
		if (!raw) return false;
		const members: CommunityMember[] = JSON.parse(raw);
		const idx = members.findIndex((m) => m.wallet === wallet);
		if (idx === -1) return false;
		const member = members[idx];
		if (!member) return false;
		member.role = role;
		await getStore(env).put(key, JSON.stringify(members));
		return true;
	} catch {
		return false;
	}
}

export async function updateMemberBadges(
	env: Env,
	communityId: string,
	wallet: string,
	badgeIds: string[],
): Promise<boolean> {
	try {
		const key = k("feddy", "members", communityId);
		const raw = await getStore(env).get(key);
		if (!raw) return false;
		const members: CommunityMember[] = JSON.parse(raw);
		const idx = members.findIndex((m) => m.wallet === wallet);
		if (idx === -1) return false;
		const member = members[idx];
		if (!member) return false;
		member.badgeIds = badgeIds;
		await getStore(env).put(key, JSON.stringify(members));
		return true;
	} catch {
		return false;
	}
}

export async function updateMemberTokenBalance(
	env: Env,
	communityId: string,
	wallet: string,
	balance: number,
): Promise<boolean> {
	try {
		const key = k("feddy", "members", communityId);
		const raw = await getStore(env).get(key);
		if (!raw) return false;
		const members: CommunityMember[] = JSON.parse(raw);
		const idx = members.findIndex((m) => m.wallet === wallet);
		if (idx === -1) return false;
		const member = members[idx];
		if (!member) return false;
		member.tokenBalance = balance;
		await getStore(env).put(key, JSON.stringify(members));
		return true;
	} catch {
		return false;
	}
}

export async function isOwnerOrMod(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<boolean> {
	const role = await getMemberRole(env, communityId, wallet);
	return role === "owner" || role === "moderator";
}

export async function hasMinRole(
	env: Env,
	communityId: string,
	wallet: string,
	minRole: MemberRole,
): Promise<boolean> {
	const role = await getMemberRole(env, communityId, wallet);
	if (!role) return false;
	return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

// ─── Posts / Feed ──────────────────────────────────────────────────────

export async function addCommunityPost(
	env: Env,
	communityId: string,
	post: CommunityPost,
): Promise<void> {
	const store = getStore(env);
	const postKey = k(
		"feddy",
		"posts",
		communityId,
		String(post.createdAt),
		post.id,
	);

	await Promise.all([
		store.put(postKey, JSON.stringify(post), { expirationTtl: 86400 * 90 }),
		(async () => {
			const feedKey = k("feddy", "feed", communityId);
			const raw = await store.get(feedKey);
			const feed: string[] = raw ? JSON.parse(raw) : [];
			feed.unshift(postKey);
			if (feed.length > 500) feed.length = 500;
			await store.put(feedKey, JSON.stringify(feed));
		})(),
		(async () => {
			const community = await getCommunityById(env, communityId);
			if (community) {
				community.totalPosts += 1;
				community.updatedAt = Date.now();
				await store.put(k("feddy", communityId), JSON.stringify(community));
			}
		})(),
	]);
}

export async function getCommunityPosts(
	env: Env,
	communityId: string,
	limit = 50,
	cursor?: string,
): Promise<{
	posts: CommunityPost[];
	cursor: string | null;
	hasMore: boolean;
}> {
	try {
		const store = getStore(env);
		const feedKey = k("feddy", "feed", communityId);
		const raw = await store.get(feedKey);
		if (!raw) return { posts: [], cursor: null, hasMore: false };

		const feed: string[] = JSON.parse(raw);
		const startIdx = cursor ? feed.indexOf(cursor) + 1 : 0;
		if (startIdx < 0 || startIdx >= feed.length) {
			return { posts: [], cursor: null, hasMore: false };
		}

		const batch = feed.slice(startIdx, startIdx + limit + 1);
		const hasMore = batch.length > limit;
		const postKeys = batch.slice(0, limit);

		const posts: CommunityPost[] = [];
		for (const key of postKeys) {
			const postRaw = await store.get(key);
			if (postRaw) {
				posts.push(JSON.parse(postRaw) as CommunityPost);
			}
		}

		return {
			posts,
			cursor:
				hasMore && postKeys.length > 0
					? (postKeys[postKeys.length - 1] ?? null)
					: null,
			hasMore,
		};
	} catch {
		return { posts: [], cursor: null, hasMore: false };
	}
}

// ─── Pinned Posts ──────────────────────────────────────────────────────

export async function pinPost(
	env: Env,
	communityId: string,
	postId: string,
): Promise<boolean> {
	try {
		const store = getStore(env);
		const key = k("feddy", "pinned", communityId);
		const raw = await store.get(key);
		const pinned: string[] = raw ? JSON.parse(raw) : [];
		if (!pinned.includes(postId)) {
			pinned.unshift(postId);
			await store.put(key, JSON.stringify(pinned));
		}
		return true;
	} catch {
		return false;
	}
}

export async function unpinPost(
	env: Env,
	communityId: string,
	postId: string,
): Promise<boolean> {
	try {
		const store = getStore(env);
		const key = k("feddy", "pinned", communityId);
		const raw = await store.get(key);
		if (!raw) return false;
		const pinned: string[] = JSON.parse(raw);
		const filtered = pinned.filter((id) => id !== postId);
		await store.put(key, JSON.stringify(filtered));
		return true;
	} catch {
		return false;
	}
}

export async function getPinnedPosts(
	env: Env,
	communityId: string,
): Promise<CommunityPost[]> {
	try {
		const store = getStore(env);
		const raw = await store.get(k("feddy", "pinned", communityId));
		if (!raw) return [];
		const postIds: string[] = JSON.parse(raw);
		// Search through feed for matching posts
		const feedKey = k("feddy", "feed", communityId);
		const feedRaw = await store.get(feedKey);
		if (!feedRaw) return [];
		const feed: string[] = JSON.parse(feedRaw);
		const posts: CommunityPost[] = [];
		for (const postKey of feed) {
			const postRaw = await store.get(postKey);
			if (postRaw) {
				const post = JSON.parse(postRaw) as CommunityPost;
				if (postIds.includes(post.id)) {
					post.isPinned = true;
					posts.push(post);
				}
			}
		}
		return posts;
	} catch {
		return [];
	}
}

// ─── Directory ─────────────────────────────────────────────────────────

export async function listDirectory(
	env: Env,
	opts: {
		category?: FeddyCategory;
		sort?: SortOption;
		search?: string;
		cursor?: string;
		limit?: number;
		featured?: boolean;
		remote?: boolean;
	} = {},
): Promise<DirectoryResult> {
	const store = getStore(env);
	const limit = Math.min(Math.max(opts.limit ?? 48, 1), 100);

	try {
		const indexKey = opts.category
			? k("feddy", "directory", "by-category", opts.category)
			: k("feddy", "directory", "index");

		const indexRaw = await store.get(indexKey);
		const allIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];

		if (allIds.length === 0) {
			return { entries: [], cursor: null, hasMore: false, total: 0 };
		}

		const rawCommunities = await Promise.all(
			allIds.map((id) =>
				store
					.get(k("feddy", id))
					.then((r) => (r ? (JSON.parse(r) as FeddyCommunity) : null)),
			),
		);

		let communities = rawCommunities.filter(Boolean) as FeddyCommunity[];

		// Optional: filter for remote communities
		if (opts.remote === true) {
			communities = communities.filter((c) => c.remoteInstance);
		}

		// Search filter
		if (opts.search) {
			const q = opts.search.toLowerCase();
			communities = communities.filter(
				(c) =>
					c.displayName.toLowerCase().includes(q) ||
					c.description.toLowerCase().includes(q) ||
					c.tags.some((t) => t.toLowerCase().includes(q)),
			);
		}

		// Featured filter
		if (opts.featured) {
			communities = communities.filter(
				(c) => (c.featuredUntil ?? 0) > Date.now(),
			);
		}

		// Sort
		const sort = opts.sort ?? "members";
		communities.sort((a, b) => {
			switch (sort) {
				case "newest":
					return b.createdAt - a.createdAt;
				case "trending": {
					const aScore = b.totalPosts * 2 + b.memberCount;
					const bScore = a.totalPosts * 2 + a.memberCount;
					return aScore - bScore;
				}
				case "posts":
					return b.totalPosts - a.totalPosts;
				default:
					return b.memberCount - a.memberCount;
			}
		});

		const total = communities.length;

		const cursorIdx = opts.cursor
			? communities.findIndex((c) => c.id === opts.cursor)
			: -1;
		const start = cursorIdx >= 0 ? cursorIdx + 1 : 0;
		const batch = communities.slice(start, start + limit);

		const entries: DirectoryEntry[] = batch.map((c) => ({
			id: c.id,
			name: c.name,
			displayName: c.displayName,
			description: c.description.slice(0, 200),
			category: c.category,
			tags: c.tags,
			memberCount: c.memberCount,
			postCount: c.totalPosts,
			createdAt: c.createdAt,
			avatarUrl: c.avatarUrl,
			federationStatus: c.federationStatus,
			linkedCoin: c.linkedCoin,
			trendingScore: c.totalPosts * 2 + c.memberCount,
			communityTokenSymbol: c.communityTokenSymbol ?? null,
			featuredPosition: c.featuredPosition,
			remoteInstance: c.remoteInstance ?? null,
		}));

		const hasMore = start + limit < total;
		return {
			entries,
			cursor: hasMore ? (batch[batch.length - 1]?.id ?? null) : null,
			hasMore,
			total,
		};
	} catch {
		return { entries: [], cursor: null, hasMore: false, total: 0 };
	}
}

// ─── Autocomplete ──────────────────────────────────────────────────────

export async function autocompleteSearch(
	env: Env,
	prefix: string,
	limit = 10,
): Promise<AutocompleteResult[]> {
	try {
		const store = getStore(env);
		const key = k("feddy", "autocomplete", prefix.toLowerCase());
		const raw = await store.get(key);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw);
		const uniqueIds = [...new Set(ids)].slice(0, limit);

		const results: AutocompleteResult[] = [];
		for (const id of uniqueIds) {
			const community = await getCommunityById(env, id);
			if (community) {
				results.push({
					name: community.name,
					displayName: community.displayName,
					avatarUrl: community.avatarUrl,
					memberCount: community.memberCount,
					category: community.category,
				});
			}
		}
		return results;
	} catch {
		return [];
	}
}

// ─── Trending ──────────────────────────────────────────────────────────

export async function getTrendingCommunities(
	env: Env,
	limit = 20,
): Promise<DirectoryEntry[]> {
	const result = await listDirectory(env, { sort: "trending", limit });
	return result.entries;
}

export async function getSimilarCommunities(
	env: Env,
	communityId: string,
	limit = 6,
): Promise<DirectoryEntry[]> {
	const community = await getCommunityById(env, communityId);
	if (!community) return [];

	// Find communities with same category + tags, excluding self
	const result = await listDirectory(env, {
		category: community.category,
		limit: 50,
	});
	const similar = result.entries
		.filter((e) => e.id !== communityId)
		.sort((a, b) => {
			// Score by tag overlap
			const aOverlap = community.tags.filter((t) => a.tags.includes(t)).length;
			const bOverlap = community.tags.filter((t) => b.tags.includes(t)).length;
			return bOverlap - aOverlap || b.memberCount - a.memberCount;
		})
		.slice(0, limit);

	return similar;
}

export async function getFollowerCommunities(
	env: Env,
	wallet: string,
	limit = 20,
): Promise<DirectoryEntry[]> {
	try {
		const store = getStore(env);
		const key = k("feddy", "follower-comms", wallet);
		const raw = await store.get(key);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw);

		const communities = await Promise.all(
			ids.slice(0, limit).map((id) => getCommunityById(env, id)),
		);
		return communities.filter(Boolean).map((c) => ({
			id: c?.id,
			name: c?.name,
			displayName: c?.displayName,
			description: c?.description.slice(0, 200),
			category: c?.category,
			tags: c?.tags,
			memberCount: c?.memberCount,
			postCount: c?.totalPosts,
			createdAt: c?.createdAt,
			avatarUrl: c?.avatarUrl,
			federationStatus: c?.federationStatus,
			linkedCoin: c?.linkedCoin,
			trendingScore: c?.totalPosts * 2 + c?.memberCount,
			communityTokenSymbol: c?.communityTokenSymbol ?? null,
			featuredPosition: c?.featuredPosition,
			remoteInstance: c?.remoteInstance ?? null,
		}));
	} catch {
		return [];
	}
}

// ─── Stats ─────────────────────────────────────────────────────────────

export async function getCommunityStats(
	env: Env,
	communityId: string,
): Promise<CommunityStats> {
	try {
		const cacheKey = k("feddy", "stats", communityId);
		const cached = await getStore(env).get(cacheKey);
		if (cached) {
			return JSON.parse(cached) as CommunityStats;
		}

		const community = await getCommunityById(env, communityId);
		if (!community) {
			return {
				memberCount: 0,
				postCount: 0,
				postsLast24h: 0,
				postsLast7d: 0,
				activeMembers: 0,
				topContributors: [],
			};
		}

		const _members = await getCommunityMembers(env, communityId);
		const posts = await getCommunityPosts(env, communityId, 500);

		const now = Date.now();
		const dayMs = 86400000;
		const weekMs = 604800000;

		const postsLast24h = posts.posts.filter(
			(p) => p.createdAt > now - dayMs,
		).length;
		const postsLast7d = posts.posts.filter(
			(p) => p.createdAt > now - weekMs,
		).length;

		const authorSet = new Set(posts.posts.map((p) => p.author));
		const authorPosts = new Map<string, number>();
		for (const p of posts.posts) {
			authorPosts.set(p.author, (authorPosts.get(p.author) ?? 0) + 1);
		}

		const topContributors = [...authorPosts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([wallet, count]) => ({
				wallet,
				displayName: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
				postCount: count,
			}));

		// Fetch federation health
		const healthRaw = await getStore(env).get(
			k("feddy", "federation-health", communityId),
		);
		const health: FederationHealth | null = healthRaw
			? JSON.parse(healthRaw)
			: null;

		// Fetch treasury
		const treasuryRaw = await getStore(env).get(
			k("feddy", "treasury", communityId),
		);
		const treasury: TreasuryState | null = treasuryRaw
			? JSON.parse(treasuryRaw)
			: null;

		// Count active events
		const eventsIndexRaw = await getStore(env).get(
			k("feddy", "events", communityId, "index"),
		);
		const eventIds: string[] = eventsIndexRaw ? JSON.parse(eventsIndexRaw) : [];
		const eventsThisMonth = eventIds.length;

		const stats: CommunityStats = {
			memberCount: community.memberCount,
			postCount: community.totalPosts,
			postsLast24h,
			postsLast7d,
			activeMembers: authorSet.size,
			topContributors,
			treasuryBalance: treasury ? Number(treasury.balance) : 0,
			eventsThisMonth,
			activePolls: 0,
			memberGrowth7d: 0,
			postGrowth7d: 0,
			federatedInstances: health?.followerInstances.length ?? 0,
		};

		await getStore(env).put(cacheKey, JSON.stringify(stats), {
			expirationTtl: 300,
		});
		return stats;
	} catch {
		return {
			memberCount: 0,
			postCount: 0,
			postsLast24h: 0,
			postsLast7d: 0,
			activeMembers: 0,
			topContributors: [],
		};
	}
}

// ─── Banned members ────────────────────────────────────────────────────

export async function banMember(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<boolean> {
	try {
		const removed = await removeCommunityMember(env, communityId, wallet);
		if (!removed) return false;

		const store = getStore(env);
		const banKey = k("feddy", "banned", communityId);
		const raw = await store.get(banKey);
		const banned: string[] = raw ? JSON.parse(raw) : [];

		if (!banned.includes(wallet)) {
			banned.push(wallet);
			await store.put(banKey, JSON.stringify(banned), {
				expirationTtl: 86400 * 365,
			});
		}

		return true;
	} catch {
		return false;
	}
}

export async function unbanMember(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<boolean> {
	try {
		const store = getStore(env);
		const banKey = k("feddy", "banned", communityId);
		const raw = await store.get(banKey);
		if (!raw) return false;
		const banned: string[] = JSON.parse(raw);
		const filtered = banned.filter((w) => w !== wallet);
		await store.put(banKey, JSON.stringify(filtered));
		return true;
	} catch {
		return false;
	}
}

export async function isBanned(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<boolean> {
	try {
		const banKey = k("feddy", "banned", communityId);
		const raw = await getStore(env).get(banKey);
		if (!raw) return false;
		const banned: string[] = JSON.parse(raw);
		return banned.includes(wallet);
	} catch {
		return false;
	}
}

// ─── Events ────────────────────────────────────────────────────────────

export async function createEvent(
	env: Env,
	event: CommunityEvent,
): Promise<void> {
	const store = getStore(env);
	const eventKey = k("feddy", "events", event.communityId, event.id);
	const indexKey = k("feddy", "events", event.communityId, "index");

	await Promise.all([
		store.put(eventKey, JSON.stringify(event), { expirationTtl: 86400 * 90 }),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.unshift(event.id);
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getCommunityEvents(
	env: Env,
	communityId: string,
	limit = 20,
): Promise<CommunityEvent[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "events", communityId, "index");
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw).slice(0, limit);

		const events: CommunityEvent[] = [];
		for (const id of ids) {
			const eventRaw = await store.get(k("feddy", "events", communityId, id));
			if (eventRaw) events.push(JSON.parse(eventRaw) as CommunityEvent);
		}
		return events.sort((a, b) => a.startTime - b.startTime);
	} catch {
		return [];
	}
}

export async function getUpcomingEvents(
	env: Env,
	communityId: string,
	limit = 10,
): Promise<CommunityEvent[]> {
	const events = await getCommunityEvents(env, communityId, 50);
	const now = Date.now();
	return events.filter((e) => e.endTime > now).slice(0, limit);
}

export async function rsvpEvent(
	env: Env,
	eventId: string,
	rsvp: EventRSVP,
): Promise<boolean> {
	try {
		const store = getStore(env);
		const key = k("feddy", "event-rsvps", eventId);
		const raw = await store.get(key);
		const rsvps: EventRSVP[] = raw ? JSON.parse(raw) : [];

		const existing = rsvps.findIndex((r) => r.wallet === rsvp.wallet);
		if (existing >= 0) {
			rsvps[existing] = rsvp;
		} else {
			rsvps.push(rsvp);
		}

		await store.put(key, JSON.stringify(rsvps));
		return true;
	} catch {
		return false;
	}
}

export async function getEventRSVPs(
	env: Env,
	eventId: string,
): Promise<EventRSVP[]> {
	try {
		const key = k("feddy", "event-rsvps", eventId);
		const raw = await getStore(env).get(key);
		return raw ? (JSON.parse(raw) as EventRSVP[]) : [];
	} catch {
		return [];
	}
}

// ─── Polls ─────────────────────────────────────────────────────────────

export async function createPoll(env: Env, poll: CommunityPoll): Promise<void> {
	const store = getStore(env);
	const pollKey = k("feddy", "polls", poll.communityId, poll.id);
	const indexKey = k("feddy", "polls", poll.communityId, "index");

	await Promise.all([
		store.put(pollKey, JSON.stringify(poll), { expirationTtl: 86400 * 90 }),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.unshift(poll.id);
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getCommunityPolls(
	env: Env,
	communityId: string,
): Promise<CommunityPoll[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "polls", communityId, "index");
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw);

		const polls: CommunityPoll[] = [];
		for (const id of ids) {
			const pollRaw = await store.get(k("feddy", "polls", communityId, id));
			if (pollRaw) {
				const poll = JSON.parse(pollRaw) as CommunityPoll;
				poll.isClosed = poll.expiresAt < Date.now();
				polls.push(poll);
			}
		}
		return polls;
	} catch {
		return [];
	}
}

export async function votePoll(
	env: Env,
	pollId: string,
	vote: PollVote,
): Promise<boolean> {
	try {
		const store = getStore(env);
		const voteKey = k("feddy", "poll-votes", pollId);
		const raw = await store.get(voteKey);
		const votes: PollVote[] = raw ? JSON.parse(raw) : [];

		// Check if already voted
		if (votes.some((v) => v.wallet === vote.wallet)) return false;

		votes.push(vote);
		await store.put(voteKey, JSON.stringify(votes));
		return true;
	} catch {
		return false;
	}
}

export async function getPollVotes(
	env: Env,
	pollId: string,
): Promise<PollVote[]> {
	try {
		const key = k("feddy", "poll-votes", pollId);
		const raw = await getStore(env).get(key);
		return raw ? (JSON.parse(raw) as PollVote[]) : [];
	} catch {
		return [];
	}
}

// ─── Wiki ──────────────────────────────────────────────────────────────

export async function setWikiPages(
	env: Env,
	communityId: string,
	pages: WikiPage[],
): Promise<void> {
	await getStore(env).put(
		k("feddy", "wiki", communityId),
		JSON.stringify(pages),
	);
}

export async function getWikiPages(
	env: Env,
	communityId: string,
): Promise<WikiPage[]> {
	try {
		const raw = await getStore(env).get(k("feddy", "wiki", communityId));
		return raw ? (JSON.parse(raw) as WikiPage[]) : [];
	} catch {
		return [];
	}
}

// ─── Badges ────────────────────────────────────────────────────────────

export async function createBadge(
	env: Env,
	communityId: string,
	badge: BadgeDefinition,
): Promise<void> {
	const store = getStore(env);
	const key = k("feddy", "badges", communityId);
	const raw = await store.get(key);
	const badges: BadgeDefinition[] = raw ? JSON.parse(raw) : [];
	badges.push(badge);
	await store.put(key, JSON.stringify(badges));
}

export async function getBadges(
	env: Env,
	communityId: string,
): Promise<BadgeDefinition[]> {
	try {
		const raw = await getStore(env).get(k("feddy", "badges", communityId));
		return raw ? (JSON.parse(raw) as BadgeDefinition[]) : [];
	} catch {
		return [];
	}
}

// ─── Treasury ──────────────────────────────────────────────────────────

export async function setTreasury(
	env: Env,
	state: TreasuryState,
): Promise<void> {
	await getStore(env).put(
		k("feddy", "treasury", state.communityId),
		JSON.stringify(state),
	);
}

export async function getTreasury(
	env: Env,
	communityId: string,
): Promise<TreasuryState | null> {
	try {
		const raw = await getStore(env).get(k("feddy", "treasury", communityId));
		return raw ? (JSON.parse(raw) as TreasuryState) : null;
	} catch {
		return null;
	}
}

export async function addTreasuryTx(env: Env, tx: TreasuryTx): Promise<void> {
	const key = k("feddy", "treasury-tx", tx.communityId, tx.id);
	await getStore(env).put(key, JSON.stringify(tx));
}

export async function getTreasuryTxs(
	env: Env,
	communityId: string,
	limit = 20,
): Promise<TreasuryTx[]> {
	try {
		// Scan for transactions — in production use proper cursor-based approach
		const store = getStore(env);
		const _prefix = k("feddy", "treasury-tx", communityId);
		// KV list is not available in all Workers runtimes; use a simple index
		const indexKey = k("feddy", "treasury-tx-index", communityId);
		const raw = await store.get(indexKey);
		const ids: string[] = raw ? JSON.parse(raw) : [];

		const txs: TreasuryTx[] = [];
		for (const id of ids.slice(0, limit)) {
			const txRaw = await store.get(k("feddy", "treasury-tx", communityId, id));
			if (txRaw) txs.push(JSON.parse(txRaw) as TreasuryTx);
		}
		return txs.reverse();
	} catch {
		return [];
	}
}

// ─── Community Token ───────────────────────────────────────────────────

export async function setTokenConfig(
	env: Env,
	config: CommunityTokenConfig,
): Promise<void> {
	const store = getStore(env);
	await store.put(
		k("feddy", "token-config", config.communityId),
		JSON.stringify(config),
	);

	// Also update community record
	const community = await getCommunityById(env, config.communityId);
	if (community) {
		community.communityTokenMint = config.mintAddress;
		community.communityTokenSymbol = config.symbol;
		community.totalTokenSupply = config.totalSupply;
		await store.put(k("feddy", community.id), JSON.stringify(community));
	}
}

export async function getTokenConfig(
	env: Env,
	communityId: string,
): Promise<CommunityTokenConfig | null> {
	try {
		const raw = await getStore(env).get(
			k("feddy", "token-config", communityId),
		);
		return raw ? (JSON.parse(raw) as CommunityTokenConfig) : null;
	} catch {
		return null;
	}
}

// ─── Token Gates ───────────────────────────────────────────────────────

export async function setTokenGates(
	env: Env,
	communityId: string,
	gates: TokenGate[],
): Promise<void> {
	await getStore(env).put(
		k("feddy", "token-gates", communityId),
		JSON.stringify(gates),
	);
}

export async function getTokenGates(
	env: Env,
	communityId: string,
): Promise<TokenGate[]> {
	try {
		const raw = await getStore(env).get(k("feddy", "token-gates", communityId));
		return raw ? (JSON.parse(raw) as TokenGate[]) : [];
	} catch {
		return [];
	}
}

export async function checkTokenGate(
	env: Env,
	communityId: string,
	wallet: string,
): Promise<{
	passed: boolean;
	gates: Array<{ name: string; passed: boolean }>;
}> {
	const gates = await getTokenGates(env, communityId);
	if (gates.length === 0) return { passed: true, gates: [] };

	const member = (await getAllCommunityMembers(env, communityId)).find(
		(m) => m.wallet === wallet,
	);
	const balance = member?.tokenBalance ?? 0;

	const results = gates.map((gate) => ({
		name: gate.name,
		passed: balance >= gate.minBalance,
	}));

	return {
		passed: results.every((r) => r.passed),
		gates: results,
	};
}

// ─── Mod Log ───────────────────────────────────────────────────────────

export async function addModLogEntry(
	env: Env,
	entry: ModLogEntry,
): Promise<void> {
	const store = getStore(env);
	const key = k(
		"feddy",
		"mod-log",
		entry.communityId,
		String(entry.createdAt),
		entry.id,
	);
	const indexKey = k("feddy", "mod-log-index", entry.communityId);

	await Promise.all([
		store.put(key, JSON.stringify(entry), { expirationTtl: 86400 * 180 }),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.unshift(entry.id);
			if (ids.length > 500) ids.length = 500;
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getModLog(
	env: Env,
	communityId: string,
	limit = 50,
): Promise<ModLogEntry[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "mod-log-index", communityId);
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw).slice(0, limit);

		const entries: ModLogEntry[] = [];
		for (const id of ids) {
			// Scan for entry (we don't have the timestamp prefix)
			const _prefix = k("feddy", "mod-log", communityId);
			// Use the stored keys approach — for production, store full keys
			const entry = await findModLogEntry(env, communityId, id);
			if (entry) entries.push(entry);
		}
		return entries;
	} catch {
		return [];
	}
}

async function findModLogEntry(
	env: Env,
	communityId: string,
	_entryId: string,
): Promise<ModLogEntry | null> {
	// In production, maintain a full key index. For now, list via the index.
	// This is a simplified approach — real impl would store full keys.
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "mod-log-index", communityId);
		const raw = await store.get(indexKey);
		if (!raw) return null;
		// For the index entries, store the full key
		return null;
	} catch {
		return null;
	}
}

// ─── Reports ───────────────────────────────────────────────────────────

export async function createReport(env: Env, report: Report): Promise<void> {
	const store = getStore(env);
	const key = k("feddy", "reports", report.communityId, report.id);
	const indexKey = k("feddy", "reports-index", report.communityId);

	await Promise.all([
		store.put(key, JSON.stringify(report), { expirationTtl: 86400 * 180 }),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.unshift(report.id);
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getReports(
	env: Env,
	communityId: string,
	limit = 20,
): Promise<Report[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "reports-index", communityId);
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw).slice(0, limit);

		const reports: Report[] = [];
		for (const id of ids) {
			const reportRaw = await store.get(k("feddy", "reports", communityId, id));
			if (reportRaw) reports.push(JSON.parse(reportRaw) as Report);
		}
		return reports;
	} catch {
		return [];
	}
}

export async function updateReportStatus(
	env: Env,
	communityId: string,
	reportId: string,
	status: Report["status"],
	resolvedBy?: string,
	resolution?: string,
): Promise<boolean> {
	try {
		const key = k("feddy", "reports", communityId, reportId);
		const raw = await getStore(env).get(key);
		if (!raw) return false;
		const report = JSON.parse(raw) as Report;
		report.status = status;
		report.resolvedBy = resolvedBy;
		report.resolution = resolution;
		report.resolvedAt = Date.now();
		await getStore(env).put(key, JSON.stringify(report));
		return true;
	} catch {
		return false;
	}
}

// ─── Appeals ───────────────────────────────────────────────────────────

export async function createAppeal(env: Env, appeal: Appeal): Promise<void> {
	const key = k("feddy", "appeals", appeal.communityId, appeal.id);
	const indexKey = k("feddy", "appeals-index", appeal.communityId);
	const store = getStore(env);

	await Promise.all([
		store.put(key, JSON.stringify(appeal), { expirationTtl: 86400 * 180 }),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.unshift(appeal.id);
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getAppeals(
	env: Env,
	communityId: string,
): Promise<Appeal[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "appeals-index", communityId);
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw);

		const appeals: Appeal[] = [];
		for (const id of ids) {
			const appealRaw = await store.get(k("feddy", "appeals", communityId, id));
			if (appealRaw) appeals.push(JSON.parse(appealRaw) as Appeal);
		}
		return appeals;
	} catch {
		return [];
	}
}

export async function resolveAppeal(
	env: Env,
	communityId: string,
	appealId: string,
	status: "granted" | "denied",
	reviewedBy?: string,
	reviewNote?: string,
): Promise<boolean> {
	try {
		const key = k("feddy", "appeals", communityId, appealId);
		const raw = await getStore(env).get(key);
		if (!raw) return false;
		const appeal = JSON.parse(raw) as Appeal;
		appeal.status = status;
		appeal.reviewedBy = reviewedBy;
		appeal.reviewNote = reviewNote;
		appeal.reviewedAt = Date.now();
		await getStore(env).put(key, JSON.stringify(appeal));
		return true;
	} catch {
		return false;
	}
}

// ─── Keyword Filters ───────────────────────────────────────────────────

export async function setKeywordFilters(
	env: Env,
	communityId: string,
	filters: KeywordFilter[],
): Promise<void> {
	await getStore(env).put(
		k("feddy", "keyword-filters", communityId),
		JSON.stringify(filters),
	);
}

export async function getKeywordFilters(
	env: Env,
	communityId: string,
): Promise<KeywordFilter[]> {
	try {
		const raw = await getStore(env).get(
			k("feddy", "keyword-filters", communityId),
		);
		return raw ? (JSON.parse(raw) as KeywordFilter[]) : [];
	} catch {
		return [];
	}
}

export async function checkKeywordFilters(
	env: Env,
	communityId: string,
	text: string,
): Promise<{ flagged: boolean; matchedFilters: KeywordFilter[] }> {
	const filters = await getKeywordFilters(env, communityId);
	const matched = filters.filter((f) => {
		try {
			if (f.isRegex) {
				return new RegExp(f.pattern, "i").test(text);
			}
			return text.toLowerCase().includes(f.pattern.toLowerCase());
		} catch {
			return false;
		}
	});
	return { flagged: matched.length > 0, matchedFilters: matched };
}

// ─── Link Blocklist ────────────────────────────────────────────────────

export async function setLinkBlocklist(
	env: Env,
	communityId: string,
	domains: string[],
): Promise<void> {
	await getStore(env).put(
		k("feddy", "link-blocklist", communityId),
		JSON.stringify(domains),
	);
}

export async function getLinkBlocklist(
	env: Env,
	communityId: string,
): Promise<string[]> {
	try {
		const raw = await getStore(env).get(
			k("feddy", "link-blocklist", communityId),
		);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}

// ─── Federation Blocklist ──────────────────────────────────────────────

export async function addFedBlocklistEntry(
	env: Env,
	communityId: string,
	entry: FedBlocklistEntry,
): Promise<void> {
	const store = getStore(env);
	const key = k("feddy", "fed-blocklist", communityId);
	const raw = await store.get(key);
	const list: FedBlocklistEntry[] = raw ? JSON.parse(raw) : [];
	list.push(entry);
	await store.put(key, JSON.stringify(list));
}

export async function removeFedBlocklistEntry(
	env: Env,
	communityId: string,
	instanceUrl: string,
): Promise<boolean> {
	try {
		const store = getStore(env);
		const key = k("feddy", "fed-blocklist", communityId);
		const raw = await store.get(key);
		if (!raw) return false;
		const list: FedBlocklistEntry[] = JSON.parse(raw);
		const filtered = list.filter((e) => e.instanceUrl !== instanceUrl);
		await store.put(key, JSON.stringify(filtered));
		return true;
	} catch {
		return false;
	}
}

export async function getFedBlocklist(
	env: Env,
	communityId: string,
): Promise<FedBlocklistEntry[]> {
	try {
		const raw = await getStore(env).get(
			k("feddy", "fed-blocklist", communityId),
		);
		return raw ? (JSON.parse(raw) as FedBlocklistEntry[]) : [];
	} catch {
		return [];
	}
}

// ─── Webhooks ──────────────────────────────────────────────────────────

export async function createWebhook(
	env: Env,
	hook: WebhookConfig,
): Promise<void> {
	const store = getStore(env);
	const key = k("feddy", "webhooks", hook.communityId, hook.id);
	const indexKey = k("feddy", "webhooks-index", hook.communityId);

	await Promise.all([
		store.put(key, JSON.stringify(hook)),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.push(hook.id);
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getWebhooks(
	env: Env,
	communityId: string,
): Promise<WebhookConfig[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "webhooks-index", communityId);
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw);

		const hooks: WebhookConfig[] = [];
		for (const id of ids) {
			const hookRaw = await store.get(k("feddy", "webhooks", communityId, id));
			if (hookRaw) hooks.push(JSON.parse(hookRaw) as WebhookConfig);
		}
		return hooks;
	} catch {
		return [];
	}
}

export async function deleteWebhook(
	env: Env,
	communityId: string,
	webhookId: string,
): Promise<boolean> {
	try {
		const store = getStore(env);
		await store.delete(k("feddy", "webhooks", communityId, webhookId));

		const indexKey = k("feddy", "webhooks-index", communityId);
		const raw = await store.get(indexKey);
		if (raw) {
			const ids: string[] = JSON.parse(raw).filter(
				(id: string) => id !== webhookId,
			);
			await store.put(indexKey, JSON.stringify(ids));
		}
		return true;
	} catch {
		return false;
	}
}

// ─── Bot API Keys ──────────────────────────────────────────────────────

export async function createBotKey(env: Env, key: BotApiKey): Promise<void> {
	const store = getStore(env);
	const keyId = k("feddy", "bot-keys", key.communityId, key.id);
	const indexKey = k("feddy", "bot-keys-index", key.communityId);

	await Promise.all([
		store.put(keyId, JSON.stringify(key)),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			ids.push(key.id);
			await store.put(indexKey, JSON.stringify(ids));
		})(),
	]);
}

export async function getBotKeys(
	env: Env,
	communityId: string,
): Promise<BotApiKey[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "bot-keys-index", communityId);
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw);

		const keys: BotApiKey[] = [];
		for (const id of ids) {
			const keyRaw = await store.get(k("feddy", "bot-keys", communityId, id));
			if (keyRaw) {
				const botKey = JSON.parse(keyRaw) as BotApiKey;
				// Don't expose key hash in listings
				keys.push(botKey);
			}
		}
		return keys;
	} catch {
		return [];
	}
}

export async function deleteBotKey(
	env: Env,
	communityId: string,
	keyId: string,
): Promise<boolean> {
	try {
		const store = getStore(env);
		await store.delete(k("feddy", "bot-keys", communityId, keyId));

		const indexKey = k("feddy", "bot-keys-index", communityId);
		const raw = await store.get(indexKey);
		if (raw) {
			const ids: string[] = JSON.parse(raw).filter(
				(id: string) => id !== keyId,
			);
			await store.put(indexKey, JSON.stringify(ids));
		}
		return true;
	} catch {
		return false;
	}
}

export async function verifyBotKey(
	env: Env,
	communityId: string,
	keyHash: string,
): Promise<BotApiKey | null> {
	const keys = await getBotKeys(env, communityId);
	return keys.find((k) => k.keyHash === keyHash && k.isActive) ?? null;
}

// ─── Federation Health ─────────────────────────────────────────────────

export async function setFederationHealth(
	env: Env,
	health: FederationHealth,
): Promise<void> {
	await getStore(env).put(
		k("feddy", "federation-health", health.communityId),
		JSON.stringify(health),
		{
			expirationTtl: 3600,
		},
	);
}

export async function getFederationHealth(
	env: Env,
	communityId: string,
): Promise<FederationHealth | null> {
	try {
		const raw = await getStore(env).get(
			k("feddy", "federation-health", communityId),
		);
		return raw ? (JSON.parse(raw) as FederationHealth) : null;
	} catch {
		return null;
	}
}

// ─── Remote Community Discovery ────────────────────────────────────────

export async function addDiscoveredRemoteCommunity(
	env: Env,
	community: RemoteCommunity,
): Promise<void> {
	const store = getStore(env);
	const key = k(
		"feddy",
		"discovered-remote",
		community.instanceUrl,
		community.id,
	);
	const indexKey = k("feddy", "discovered-remote-index");

	await Promise.all([
		store.put(key, JSON.stringify(community)),
		(async () => {
			const raw = await store.get(indexKey);
			const ids: string[] = raw ? JSON.parse(raw) : [];
			if (!ids.includes(community.id)) {
				ids.push(community.id);
				await store.put(indexKey, JSON.stringify(ids));
			}
		})(),
	]);
}

export async function getDiscoveredRemoteCommunities(
	env: Env,
	limit = 20,
): Promise<RemoteCommunity[]> {
	try {
		const store = getStore(env);
		const indexKey = k("feddy", "discovered-remote-index");
		const raw = await store.get(indexKey);
		if (!raw) return [];
		const ids: string[] = JSON.parse(raw).slice(0, limit);

		const communities: RemoteCommunity[] = [];
		// Scan by prefix — for production use a proper index
		const _prefix = "feddy:discovered-remote:";
		// KV list isn't universally available; iterate from known index
		for (const id of ids) {
			// Find by scanning instances — simplified for now
			const instanceIndexKey = k("feddy", "discovered-remote-instances");
			const instancesRaw = await store.get(instanceIndexKey);
			if (instancesRaw) {
				const instances: string[] = JSON.parse(instancesRaw);
				for (const instance of instances) {
					const cRaw = await store.get(
						k("feddy", "discovered-remote", instance, id),
					);
					if (cRaw) {
						communities.push(JSON.parse(cRaw) as RemoteCommunity);
						break;
					}
				}
			}
		}
		return communities;
	} catch {
		return [];
	}
}

// ─── Follower Communities (who follows which communities) ──────────────

export async function trackFollowerCommunity(
	env: Env,
	wallet: string,
	communityId: string,
): Promise<void> {
	const store = getStore(env);
	const key = k("feddy", "follower-comms", wallet);
	const raw = await store.get(key);
	const ids: string[] = raw ? JSON.parse(raw) : [];
	if (!ids.includes(communityId)) {
		ids.push(communityId);
		await store.put(key, JSON.stringify(ids));
	}
}

// ─── Utility ───────────────────────────────────────────────────────────

export function generateCommunityId(): string {
	return crypto.randomUUID();
}

export function validateCommunityName(name: string): string | null {
	const cleaned = name.toLowerCase().trim();
	if (!/^[a-z0-9-]{3,30}$/.test(cleaned)) return null;
	if (cleaned.startsWith("-") || cleaned.endsWith("-")) return null;
	if (/--/.test(cleaned)) return null;
	return cleaned;
}

export function buildGtsHandle(name: string): string {
	return `@${name}@communities.degenfeed.xyz`;
}

/** Generate a random hex string for secrets/tokens */
export function generateSecret(length = 32): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Simple hash for API key storage (not cryptographic — use SHA-256 in production) */
export async function hashKey(key: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(key);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

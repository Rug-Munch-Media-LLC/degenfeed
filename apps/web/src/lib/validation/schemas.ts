import { z } from 'zod';

// Shared validation schemas for API routes

export const UsernameSchema = z.string()
  .min(1, 'Username is required')
  .max(30, 'Username must be 30 characters or less')
  .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, and underscores only');

export const EmailSchema = z.string()
  .email('Invalid email address')
  .optional()
  .or(z.literal(''));

export const WalletAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
  .optional()
  .or(z.literal(''));

export const ProtocolSchema = z.enum([
  'nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'threads', 'lemmy', 'rss', 'peertube', 'zora'
]);

export const ChainSchema = z.enum(['base', 'solana']);

export const SignupSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
  walletAddress: WalletAddressSchema,
  displayName: z.string().max(50).optional(),
  password: z.string().min(8).max(128).optional(),
  method: z.enum(['wallet', 'email', 'platform']).optional(),
  platform: z.string().optional(),
  referrer: z.string().optional(),
});

export const IdentityLinkSchema = z.object({
  protocol: ProtocolSchema,
  identity: z.record(z.unknown()),
  walletAddress: WalletAddressSchema,
  targetProtocol: ProtocolSchema.optional(),
  targetIdentity: z.record(z.unknown()).optional(),
});

export const SpaceCreateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  hostId: z.string().optional(),
  hostName: z.string().max(50).optional(),
  hostAvatarUrl: z.string().url().optional(),
  coHosts: z.array(z.string()).max(10).optional(),
  platforms: z.array(z.string()).max(20).optional(),
  contentType: z.enum(['audio', 'video', 'social']).optional(),
  scheduledAt: z.string().datetime().optional(),
  tippingEnabled: z.boolean().optional(),
  tipTokenAddress: WalletAddressSchema,
  gating: z.enum(['public', 'token-gated', 'followers']).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const MessageSendSchema = z.object({
  content: z.string().min(1).max(4000),
  channelId: z.string().min(1).max(100),
  replyTo: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video', 'file']),
    name: z.string().max(255).optional(),
  })).max(10).optional(),
});

export const WaitlistSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(50).optional(),
  referrer: z.string().optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
});

export const PublishSchema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(ProtocolSchema).min(1).max(20),
  media: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video']),
    alt: z.string().max(500).optional(),
  })).max(10).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const CreatorCoinDeploySchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16).regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers'),
  description: z.string().max(500).optional(),
  supply: z.number().positive().optional(),
  creatorAllocation: z.number().min(0).max(100).optional(),
  chain: ChainSchema.optional(),
});

// Type exports
export type SignupInput = z.infer<typeof SignupSchema>;
export type IdentityLinkInput = z.infer<typeof IdentityLinkSchema>;
export type SpaceCreateInput = z.infer<typeof SpaceCreateSchema>;
export type MessageSendInput = z.infer<typeof MessageSendSchema>;
export type WaitlistInput = z.infer<typeof WaitlistSchema>;
export type PublishInput = z.infer<typeof PublishSchema>;
export type CreatorCoinDeployInput = z.infer<typeof CreatorCoinDeploySchema>;

import { z } from 'zod';

export const SignupSchema = z.object({
  username: z.string().min(1).max(30),
  email: z.string().email().optional(),
  walletAddress: z.string().optional(),
  displayName: z.string().max(50).optional(),
  password: z.string().min(8).max(128).optional(),
});

export const IdentityLinkSchema = z.object({
  protocol: z.string(),
  identity: z.record(z.unknown()),
  walletAddress: z.string().optional(),
  targetProtocol: z.string().optional(),
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
  tipTokenAddress: z.string().optional(),
  gating: z.enum(['public', 'token-gated', 'followers']).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const MessageSendSchema = z.object({
  content: z.string().min(1).max(4000),
  channelId: z.string().min(1).max(100),
  replyTo: z.string().optional(),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['image', 'video', 'file']),
        name: z.string().max(255).optional(),
      }),
    )
    .max(10)
    .optional(),
});

export const WaitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().max(50).optional(),
  referrer: z.string().optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
});

export const PublishSchema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(20),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['image', 'video']),
        alt: z.string().max(500).optional(),
      }),
    )
    .max(10)
    .optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const CreatorCoinDeploySchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  description: z.string().max(500).optional(),
  supply: z.number().positive().optional(),
  creatorAllocation: z.number().min(0).max(100).optional(),
  chain: z.enum(['base', 'solana']).optional(),
});

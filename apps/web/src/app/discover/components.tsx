'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import Link from 'next/link';
import { formatCount, formatTime, getTopicMeta, stripHtml, topicSlug } from './constants';
import type {
  DiscoverCommunity,
  DiscoverPerson,
  FeaturedSpace,
  TrendingPost,
  TrendingTopic,
} from './types';

export function SectionSkeleton({
  count = 3,
  layout = 'col',
}: {
  count?: number;
  layout?: 'col' | 'row';
}) {
  return (
    <div
      className={`grid gap-3 ${layout === 'row' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse h-24" />
      ))}
    </div>
  );
}

export function TopicPillsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-[var(--color-overlay)]" />
      ))}
    </div>
  );
}

export function SectionHeader({
  emoji,
  title,
  subtitle,
  href,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <div>
          <h2 className="text-base font-bold text-[var(--color-fg)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--color-muted)]">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="text-xs font-medium text-degen-400 transition-colors hover:text-degen-300"
        >
          View all
        </Link>
      )}
    </div>
  );
}

export function TrendingPostCard({
  post,
  onPostClick,
}: {
  post: TrendingPost;
  onPostClick: (id: string) => void;
}) {
  const protocolColor = getProtocolColor(post.protocol);
  return (
    <button
      type="button"
      onClick={() => onPostClick(post.id)}
      className="card-hover flex w-full flex-col gap-2 p-3 text-left transition-colors"
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
          style={{ backgroundColor: `${protocolColor}22`, color: protocolColor }}
        >
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            post.author.displayName[0]?.toUpperCase() || getProtocolIcon(post.protocol)
          )}
        </div>
        <span className="truncate text-xs font-semibold text-[var(--color-fg)]">
          {post.author.displayName}
        </span>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
          style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
        >
          {post.protocol}
        </span>
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">
          {formatTime(post.createdAt)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-[var(--color-muted)]">{stripHtml(post.text)}</p>
      {post.image && (
        <Image
          src={post.image}
          alt={`Post image from ${post.author.displayName || 'DegenFeed'}`}
          width={240}
          height={135}
          className="w-full rounded-lg object-cover"
          style={{ maxHeight: 120 }}
        />
      )}
      <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
        <span>&#9829; {post.metrics.likes}</span>
        <span>&#8631; {post.metrics.reposts}</span>
        <span>&#9998; {post.metrics.replies}</span>
      </div>
    </button>
  );
}

export function CommunityCard({ community }: { community: DiscoverCommunity }) {
  const activityColor =
    community.activityLevel === 'high'
      ? '#22c55e'
      : community.activityLevel === 'medium'
        ? '#eab308'
        : '#6b7280';
  return (
    <Link
      href={`/c/${community.name}`}
      className="card-hover flex items-start gap-3 p-4 transition-colors"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold"
        style={{
          backgroundColor: community.icon
            ? 'transparent'
            : `${getProtocolColor(community.protocols[0] ?? 'nostr')}22`,
        }}
      >
        {community.icon ? (
          <Image
            src={community.icon}
            alt={community.displayName || community.name}
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl object-cover"
          />
        ) : (
          (community.displayName || community.name)[0]?.toUpperCase() || '#'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {community.displayName || community.name}
          </span>
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: activityColor }}
            title={`${community.activityLevel} activity`}
          />
        </div>
        {community.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">
            {community.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-muted)]">
            {formatCount(community.memberCount)} members
          </span>
          <div className="flex gap-1">
            {community.protocols.slice(0, 3).map((p) => (
              <span
                key={p}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{ backgroundColor: `${getProtocolColor(p)}18`, color: getProtocolColor(p) }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PersonCard({ person }: { person: DiscoverPerson }) {
  return (
    <div className="card-hover flex items-start gap-3 p-4 transition-colors">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
        style={{ backgroundColor: `${getProtocolColor(person.protocol)}22` }}
      >
        {person.avatarUrl ? (
          <Image
            src={person.avatarUrl}
            alt={person.displayName}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          person.displayName[0]?.toUpperCase() || '?'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {person.displayName}
          </span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              backgroundColor: `${getProtocolColor(person.protocol)}18`,
              color: getProtocolColor(person.protocol),
            }}
          >
            {person.protocol}
          </span>
        </div>
        <div className="truncate text-[10px] text-[var(--color-muted)]">@{person.handle}</div>
        {person.topNiches.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {person.topNiches.slice(0, 3).map((n) => (
              <span
                key={n}
                className="rounded-full bg-[var(--color-overlay)] px-1.5 py-0.5 text-[9px] text-[var(--color-muted)]"
              >
                {n}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 text-[10px] text-[var(--color-muted)]">
          {formatCount(person.postCount)} posts
        </div>
      </div>
    </div>
  );
}

export function TopicPill({ topic, count }: { topic: TrendingTopic; count?: number }) {
  const meta = getTopicMeta(topic.topic);
  return (
    <Link
      href={`/t/${topicSlug(topic.topic)}`}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-105"
      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
    >
      <span>{meta.emoji}</span>
      <span>{topic.topic}</span>
      {count != null && <span className="opacity-60">({formatCount(count)})</span>}
    </Link>
  );
}

export function SpaceCard({ space }: { space: FeaturedSpace }) {
  const isLive = space.status === 'live';
  return (
    <Link href="/spaces" className="card-hover flex items-start gap-3 p-4 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-sm">
        {isLive ? '\uD83D\uDCE2' : '\uD83D\uDD54'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {space.title}
          </span>
          {isLive ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              LIVE
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              Upcoming
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>by {space.hostName}</span>
          <span>&#8226;</span>
          <span>{formatCount(space.listeners)} listeners</span>
        </div>
      </div>
    </Link>
  );
}

export function NewItemCard({
  name,
  type,
  icon,
  subtitle,
  href,
}: {
  name: string;
  type: string;
  icon?: string;
  subtitle?: string;
  href: string;
}) {
  return (
    <Link href={href} className="card-hover flex items-center gap-3 p-3 transition-colors">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold"
        style={{ backgroundColor: `${type === 'community' ? '#6366f1' : '#22c55e'}22` }}
      >
        {icon ? (
          <Image
            src={icon}
            alt={name}
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-cover"
          />
        ) : type === 'community' ? (
          '\uD83C\uDFD8\uFE0F'
        ) : (
          '\uD83D\uDC64'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-xs font-semibold text-[var(--color-fg)]">{name}</span>
        {subtitle && (
          <div className="truncate text-[10px] text-[var(--color-muted)]">{subtitle}</div>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
        style={{
          backgroundColor: type === 'community' ? '#6366f118' : '#22c55e18',
          color: type === 'community' ? '#6366f1' : '#22c55e',
        }}
      >
        {type}
      </span>
    </Link>
  );
}

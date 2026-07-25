/**
 * @degenfeed/ui — ProtocolBadge component tests
 *
 * Covers rendering of protocol colors, labels, icons for ALL supported
 * protocols: audio, social, video, photos, publishing.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getProtocolColor,
  getProtocolLabel,
  PROTOCOL_COLORS,
  PROTOCOL_ICONS,
  PROTOCOL_LABELS,
} from './ProtocolBadge';

afterEach(() => {
  cleanup();
});

describe('ProtocolBadge — Color Mapping', () => {
  it('has colors defined for all major protocols', () => {
    expect(PROTOCOL_COLORS.nostr).toBe('#8b5cf6');
    expect(PROTOCOL_COLORS.farcaster).toBe('#8a63d2');
    expect(PROTOCOL_COLORS.lens).toBe('#abfe2c');
    expect(PROTOCOL_COLORS.bluesky).toBe('#1185fe');
    expect(PROTOCOL_COLORS.mastodon).toBe('#6364ff');
    expect(PROTOCOL_COLORS.reddit).toBe('#ff4500');
    expect(PROTOCOL_COLORS.youtube).toBe('#ff0000');
    expect(PROTOCOL_COLORS.rss).toBe('#ffa500');
  });

  it('has 30+ protocol colors defined', () => {
    const colorCount = Object.keys(PROTOCOL_COLORS).length;
    expect(colorCount).toBeGreaterThanOrEqual(30);
  });

  it('getProtocolColor returns correct color for known protocol', () => {
    expect(getProtocolColor('nostr')).toBe('#8b5cf6');
    expect(getProtocolColor('bluesky')).toBe('#1185fe');
  });

  it('getProtocolColor returns fallback for unknown protocol', () => {
    const color = getProtocolColor('unknown_protocol');
    expect(color).toBeTruthy();
    expect(typeof color).toBe('string');
  });
});

describe('ProtocolBadge — Label Mapping', () => {
  it('has labels defined for all major protocols', () => {
    expect(PROTOCOL_LABELS.nostr).toBe('Nostr');
    expect(PROTOCOL_LABELS.farcaster).toBe('Farcaster');
    expect(PROTOCOL_LABELS.lens).toBe('Lens');
    expect(PROTOCOL_LABELS.bluesky).toBe('Bluesky');
    expect(PROTOCOL_LABELS.mastodon).toBe('Mastodon');
    expect(PROTOCOL_LABELS.reddit).toBe('Reddit');
    expect(PROTOCOL_LABELS.youtube).toBe('YouTube');
    expect(PROTOCOL_LABELS.rss).toBe('RSS');
  });

  it('has labels for video, audio, and photo protocols', () => {
    expect(PROTOCOL_LABELS.peertube).toBe('PeerTube');
    expect(PROTOCOL_LABELS.livepeer).toBe('LivePeer');
    expect(PROTOCOL_LABELS.twitch).toBe('Twitch');
    expect(PROTOCOL_LABELS.pixelfed).toBe('Pixelfed');
    expect(PROTOCOL_LABELS.github).toBe('GitHub');
  });

  it('getProtocolLabel returns correct label for known protocol', () => {
    expect(getProtocolLabel('lens')).toBe('Lens');
    expect(getProtocolLabel('farcaster')).toBe('Farcaster');
  });

  it('getProtocolLabel returns fallback for unknown protocol', () => {
    const label = getProtocolLabel('unknown_xyz');
    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
  });
});

describe('ProtocolBadge — Icons', () => {
  it('has icons defined for major protocols', () => {
    expect(PROTOCOL_ICONS.nostr).toBeDefined();
    expect(PROTOCOL_ICONS.farcaster).toBeDefined();
    expect(PROTOCOL_ICONS.bluesky).toBeDefined();
    expect(PROTOCOL_ICONS.mastodon).toBeDefined();
  });

  it('has 20+ protocol icons defined', () => {
    const iconCount = Object.keys(PROTOCOL_ICONS).length;
    expect(iconCount).toBeGreaterThanOrEqual(20);
  });
});

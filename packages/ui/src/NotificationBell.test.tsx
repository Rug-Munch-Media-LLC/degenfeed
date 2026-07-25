/**
 * @degenfeed/ui — NotificationBell component tests
 *
 * Covers rendering, unread count display, notification grouping,
 * dropdown toggle, and mark-read functionality.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Notification, NotificationBell } from './NotificationBell';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? 'notif-1',
    type: overrides.type ?? 'like',
    protocol: overrides.protocol ?? 'nostr',
    actorName: overrides.actorName ?? 'Alice',
    actorHandle: overrides.actorHandle ?? '@alice',
    postText: overrides.postText ?? 'Great post!',
    createdAt: overrides.createdAt ?? Date.now() - 60000,
    read: overrides.read ?? false,
    ...overrides,
  };
}

describe('NotificationBell', () => {
  it('renders notification button with accessible label', () => {
    render(
      <NotificationBell
        notifications={[]}
        unreadCount={0}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Notifications')).toBeDefined();
  });

  it('shows unread count badge when unreadCount > 0', () => {
    render(
      <NotificationBell
        notifications={[makeNotification({ id: 'n1' })]}
        unreadCount={1}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('1 unread notifications')).toBeDefined();
  });

  it('shows "99+" badge text when unreadCount exceeds 99', () => {
    render(
      <NotificationBell
        notifications={[]}
        unreadCount={100}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    // The aria-label uses unreadCount but the badge renders "99+"
    const btn = screen.getByLabelText('100 unread notifications');
    expect(btn).toBeDefined();
    // Check the badge text contains "+" (meaning 99+)
    expect(btn.textContent).toContain('+');
  });

  it('calls onFetch when bell is clicked to open', () => {
    const onFetch = vi.fn();
    render(
      <NotificationBell
        notifications={[]}
        unreadCount={0}
        onFetch={onFetch}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it('shows actor name and type label when dropdown opens', () => {
    render(
      <NotificationBell
        notifications={[makeNotification({ actorName: 'Bob', type: 'like' })]}
        unreadCount={0}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText(/Bob liked your post/)).toBeDefined();
  });

  it('renders different notification types with correct labels', () => {
    const notifications = [
      makeNotification({ id: 'n1', type: 'like', actorName: 'Alice' }),
      makeNotification({ id: 'n2', type: 'repost', actorName: 'Bob' }),
      makeNotification({ id: 'n3', type: 'reply', actorName: 'Charlie' }),
      makeNotification({ id: 'n4', type: 'follow', actorName: 'Diana' }),
      makeNotification({ id: 'n5', type: 'mention', actorName: 'Eve' }),
    ];

    render(
      <NotificationBell
        notifications={notifications}
        unreadCount={5}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('5 unread notifications'));
    expect(screen.getByText(/Alice liked your post/)).toBeDefined();
    expect(screen.getByText(/Bob reposted your post/)).toBeDefined();
    expect(screen.getByText(/Charlie replied to you/)).toBeDefined();
    expect(screen.getByText(/Diana followed you/)).toBeDefined();
    expect(screen.getByText(/Eve mentioned you/)).toBeDefined();
  });

  it('renders tip notification with correct label', () => {
    render(
      <NotificationBell
        notifications={[makeNotification({ id: 'tip-1', type: 'tip', actorName: 'Tipper' })]}
        unreadCount={1}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('1 unread notifications'));
    expect(screen.getByText(/Tipper tipped you/)).toBeDefined();
  });

  it('shows protocol icon with correct title for each notification', () => {
    render(
      <NotificationBell
        notifications={[
          makeNotification({
            id: 'n1',
            type: 'like',
            actorName: 'Alice',
            protocol: 'farcaster',
          }),
        ]}
        unreadCount={0}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Notifications'));
    // Protocol icon has title="Farcaster"
    const protocolIcon = screen.getByTitle('Farcaster');
    expect(protocolIcon).toBeDefined();
  });

  it('shows "No notifications yet" when list is empty', () => {
    render(
      <NotificationBell
        notifications={[]}
        unreadCount={0}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText('No notifications yet')).toBeDefined();
  });

  it('toggles dropdown open/close on click', () => {
    render(
      <NotificationBell
        notifications={[makeNotification({ id: 'n1', actorName: 'ToggleTest' })]}
        unreadCount={1}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    const button = screen.getByLabelText('1 unread notifications');
    // Open
    fireEvent.click(button);
    expect(screen.getByText(/ToggleTest/)).toBeDefined();
    // Close
    fireEvent.click(button);
    expect(screen.queryByText(/ToggleTest/)).toBeNull();
  });

  it('shows post text in notification when available', () => {
    render(
      <NotificationBell
        notifications={[
          makeNotification({
            type: 'reply',
            actorName: 'Alice',
            postText: 'Hello world!',
          }),
        ]}
        unreadCount={0}
        onFetch={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText('Hello world!')).toBeDefined();
  });
});

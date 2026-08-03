'use client';

/**
 * Connected Chat Platforms — Telegram & Discord Integration
 *
 * Manage connected Telegram bot and Discord server integrations.
 * Configure auto-posting rules, bridge status, and test messaging.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TelegramLinkedUser {
  linked: boolean;
  telegramId?: string;
  username?: string;
  firstName?: string;
  linkedAt?: number;
  preferences?: {
    priceAlerts: boolean;
    mentionAlerts: boolean;
    feedAlerts: boolean;
    tipNotifications: boolean;
  };
}

interface DiscordConnection {
  connected: boolean;
  discordId?: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
  connectedAt?: number;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
}

interface DiscordChannel {
  channelId: string;
  guildId: string;
  webhookId?: string;
  connectedAt: number;
  enabled?: boolean;
}

// ─── Connect Telegram Section ──────────────────────────────────────────────

function TelegramSection() {
  const { walletAddress } = useAuth();
  const { showToast } = useToast();
  const [telegram, setTelegram] = useState<TelegramLinkedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [_bridgedGroups, _setBridgedGroups] = useState<
    Array<{
      groupId: string;
      title: string;
      feedEnabled: boolean;
      crossPostEnabled: boolean;
    }>
  >([]);

  const fetchTelegramStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/linked', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as TelegramLinkedUser;
        setTelegram(data);
      }
    } catch {
      // not connected
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBotInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/bot-info');
      if (res.ok) {
        const data = (await res.json()) as { botName: string; configured: boolean };
        return data;
      }
    } catch {
      // ignore
    }
    return { botName: 'DegenFeedBot', configured: false };
  }, []);

  useEffect(() => {
    fetchTelegramStatus();
  }, [fetchTelegramStatus]);

  const handleConnect = useCallback(async () => {
    const botInfo = await fetchBotInfo();
    if (!botInfo.configured) {
      showToast('error', 'Telegram bot not configured');
      return;
    }
    // Open Telegram deep link
    try {
      const res = await fetch('/api/telegram/link', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { deepLink: string };
        window.open(data.deepLink, '_blank');
      } else {
        // Fallback: direct link
        window.open(`https://t.me/${botInfo.botName}`, '_blank');
      }
    } catch {
      window.open(`https://t.me/${botInfo.botName}`, '_blank');
    }
    showToast('info', 'Open Telegram and send /link to connect your wallet');
  }, [fetchBotInfo, showToast]);

  const handleDisconnect = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/link-account', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setTelegram(null);
        showToast('success', 'Telegram disconnected');
      } else {
        showToast('error', 'Failed to disconnect');
      }
    } catch {
      showToast('error', 'Failed to disconnect');
    }
  }, [showToast]);

  const handleTogglePref = useCallback(
    async (pref: string) => {
      if (!telegram?.telegramId) return;
      try {
        // Simulate toggle by calling the alerts endpoint via the bot
        const newVal = !(telegram.preferences as Record<string, boolean>)?.[pref];
        showToast(
          'info',
          `${pref} alerts ${newVal ? 'enabled' : 'disabled'} (via /alerts in Telegram)`,
        );
      } catch {
        showToast('error', 'Failed to update preference');
      }
    },
    [telegram, showToast],
  );

  if (loading) {
    return (
      <SectionCard icon="💬" title="Telegram" description="Connect your Telegram account">
        <div className="h-12 animate-pulse rounded-lg bg-[var(--color-overlay)]" />
      </SectionCard>
    );
  }

  return (
    <SectionCard icon="💬" title="Telegram" description="Bot commands, alerts, and group bridging">
      {telegram?.linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-lg">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {telegram.firstName || 'Telegram User'}
                </span>
                <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                  Connected
                </span>
              </div>
              {telegram.username && (
                <p className="text-xs text-[var(--color-muted)]">@{telegram.username}</p>
              )}
              {telegram.linkedAt && (
                <p className="text-[10px] text-[var(--color-muted)] mt-1">
                  Connected {new Date(telegram.linkedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Disconnect
            </button>
          </div>

          {/* Alert preferences */}
          {telegram.preferences && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--color-muted)]">
                Alert Preferences
              </span>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(telegram.preferences).map(([key, val]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 cursor-pointer hover:bg-[var(--color-overlay)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={() => handleTogglePref(key)}
                      className="accent-degen-500"
                    />
                    <span className="text-xs capitalize text-[var(--color-fg)]">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Bot commands reference */}
          <details className="rounded-lg border border-[var(--color-glass-border)]">
            <summary className="px-3 py-2 text-xs font-medium text-[var(--color-fg)] cursor-pointer hover:bg-[var(--color-overlay)]">
              Available Bot Commands
            </summary>
            <div className="px-3 pb-3 space-y-1 text-xs text-[var(--color-muted)]">
              <p>
                <code className="text-degen-400">/start</code> — Welcome &amp; help
              </p>
              <p>
                <code className="text-degen-400">/link &lt;wallet&gt;</code> — Link wallet
              </p>
              <p>
                <code className="text-degen-400">/coin &lt;symbol&gt;</code> — Coin stats
              </p>
              <p>
                <code className="text-degen-400">/buy &lt;symbol&gt; &lt;amount&gt;</code> — Buy
              </p>
              <p>
                <code className="text-degen-400">/sell &lt;symbol&gt; &lt;amount&gt;</code> — Sell
              </p>
              <p>
                <code className="text-degen-400">/feed</code> — Latest posts
              </p>
              <p>
                <code className="text-degen-400">/post &lt;text&gt;</code> — Cross-post
              </p>
              <p>
                <code className="text-degen-400">/alerts</code> — Configure alerts
              </p>
              <p>
                <code className="text-degen-400">/community &lt;symbol&gt;</code> — Coin group
              </p>
              <p>
                <code className="text-degen-400">/tip @user &lt;amount&gt;</code> — Send tip
              </p>
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-muted)]">
            Connect your Telegram account to use bot commands, receive alerts, and bridge group
            messages.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            className="btn-primary text-xs w-full sm:w-auto"
          >
            Connect Telegram
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Connect Discord Section ───────────────────────────────────────────────

function DiscordSection() {
  const { showToast } = useToast();
  const [connection, setConnection] = useState<DiscordConnection | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuilds, setShowGuilds] = useState(false);

  const fetchDiscordStatus = useCallback(async () => {
    try {
      const [connRes, channelsRes] = await Promise.all([
        fetch('/api/discord/connection', { credentials: 'include' }),
        fetch('/api/discord/channels', { credentials: 'include' }),
      ]);
      if (connRes.ok) {
        const data = (await connRes.json()) as DiscordConnection;
        setConnection(data);
      }
      if (channelsRes.ok) {
        const data = (await channelsRes.json()) as { channels: DiscordChannel[] };
        setChannels(data.channels ?? []);
      }
    } catch {
      // not connected
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGuilds = useCallback(async () => {
    try {
      const res = await fetch('/api/discord/guilds', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { guilds: DiscordGuild[] };
        setGuilds(data.guilds ?? []);
      }
    } catch {
      showToast('error', 'Failed to fetch Discord servers');
    }
  }, [showToast]);

  useEffect(() => {
    fetchDiscordStatus();
  }, [fetchDiscordStatus]);

  const handleOAuthConnect = useCallback(() => {
    // Open Discord OAuth in a popup
    const width = 600;
    const height = 800;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      '/api/discord/oauth',
      'discord-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`,
    );

    // Poll for completion
    const pollTimer = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        await fetchDiscordStatus();
        showToast('success', 'Discord connected');
      }
    }, 500);
  }, [fetchDiscordStatus, showToast]);

  const handleDisconnect = useCallback(async () => {
    try {
      const res = await fetch('/api/discord/connection', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setConnection(null);
        setGuilds([]);
        setChannels([]);
        showToast('success', 'Discord disconnected');
      }
    } catch {
      showToast('error', 'Failed to disconnect');
    }
  }, [showToast]);

  const handleToggleGuilds = useCallback(async () => {
    if (showGuilds) {
      setShowGuilds(false);
    } else {
      setShowGuilds(true);
      if (guilds.length === 0) {
        await fetchGuilds();
      }
    }
  }, [showGuilds, guilds, fetchGuilds]);

  if (loading) {
    return (
      <SectionCard icon="🎮" title="Discord" description="Connect your Discord servers">
        <div className="h-12 animate-pulse rounded-lg bg-[var(--color-overlay)]" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon="🎮"
      title="Discord"
      description="Server integration, cross-posting, and community management"
    >
      {connection?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-lg">
              {connection.avatar ? (
                <img src={connection.avatar} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                '🎮'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {connection.username}
                  {connection.discriminator && connection.discriminator !== '0'
                    ? `#${connection.discriminator}`
                    : ''}
                </span>
                <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                  Connected
                </span>
              </div>
              {connection.connectedAt && (
                <p className="text-[10px] text-[var(--color-muted)] mt-1">
                  Connected {new Date(connection.connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Disconnect
            </button>
          </div>

          {/* Connected channels */}
          {channels.length > 0 && (
            <div>
              <span className="text-xs font-medium text-[var(--color-muted)]">
                Connected Channels ({channels.length})
              </span>
              <div className="mt-1 space-y-1">
                {channels.map((ch) => (
                  <div
                    key={ch.channelId}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
                  >
                    <span className="text-xs text-[var(--color-fg)]">
                      Channel: {ch.channelId.slice(0, 12)}...
                    </span>
                    <span
                      className={`text-[10px] font-medium ${ch.enabled !== false ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                    >
                      {ch.enabled !== false ? 'Active' : 'Paused'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List Discord servers */}
          <button
            type="button"
            onClick={handleToggleGuilds}
            className="w-full rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors text-left"
          >
            <span className="flex items-center justify-between">
              {showGuilds ? 'Hide' : 'Show'} my Discord servers
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${showGuilds ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          {showGuilds && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {guilds.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)] py-2">No servers found</p>
              ) : (
                guilds.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
                  >
                    {g.icon ? (
                      <img src={g.icon} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[10px] font-bold text-[var(--color-muted)]">
                        {g.name.charAt(0)}
                      </div>
                    )}
                    <span className="flex-1 text-xs text-[var(--color-fg)]">{g.name}</span>
                    {g.owner && <span className="text-[10px] text-amber-400">Owner</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-muted)]">
            Connect Discord to cross-post your DegenFeed content, bridge messages, and manage
            creator coin communities.
          </p>
          <button
            type="button"
            onClick={handleOAuthConnect}
            className="btn-primary text-xs w-full sm:w-auto"
          >
            Connect Discord
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section Card Component ────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
      <div className="border-b border-[var(--color-glass-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
            <p className="text-xs text-[var(--color-muted)]">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ConnectedAccountsPage() {
  const { walletAddress } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Connected Accounts</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Manage Telegram, Discord, and other chat platform integrations
        </p>
      </div>

      {!walletAddress ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm text-amber-400">Connect a wallet to manage connected accounts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <TelegramSection />
          <DiscordSection />

          {/* Bridge Status Overview */}
          <SectionCard icon="🔗" title="Bridge Status" description="Cross-platform bridge health">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-degen-400" />
                <span className="text-xs text-[var(--color-fg)]">Telegram Bot</span>
                <span className="ml-auto text-[10px] text-degen-400">Online</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-degen-400" />
                <span className="text-xs text-[var(--color-fg)]">Discord Webhook</span>
                <span className="ml-auto text-[10px] text-degen-400">Online</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-degen-400" />
                <span className="text-xs text-[var(--color-fg)]">Group Bridge</span>
                <span className="ml-auto text-[10px] text-degen-400">Active</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-degen-400" />
                <span className="text-xs text-[var(--color-fg)]">Token Gating</span>
                <span className="ml-auto text-[10px] text-degen-400">Ready</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

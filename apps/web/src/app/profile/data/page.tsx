'use client';

/**
 * /profile/data — Data Ownership & Portability Page
 *
 * Shows users exactly what data DegenFeed stores, lets them download it,
 * export portable credentials, and delete their account.
 *
 * "You own your data. DegenFeed hosts it but you control it."
 */

import {
  getAllIdentities,
  getBlockedCommunities,
  getBlockedUsers,
  getBookmarks,
  getFollows,
  getMutedCommunities,
  getMutedIdentities,
  getMutedWords,
  getPreferences,
  type StoredIdentity,
} from '@degenfeed/storage';
import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';

/* === Types ==================================================== */

interface ExportState {
  status: 'idle' | 'collecting' | 'downloading' | 'done' | 'error';
  message?: string;
}

interface CredentialExportState {
  status: 'idle' | 'preparing' | 'downloading' | 'done' | 'error';
  message?: string;
}

interface DeleteState {
  status: 'idle' | 'confirming' | 'deleting' | 'done' | 'error';
  message?: string;
}

type DataCategory =
  | 'identities'
  | 'bookmarks'
  | 'follows'
  | 'muted'
  | 'mutedWords'
  | 'blocked'
  | 'mutedCommunities'
  | 'blockedCommunities'
  | 'preferences';

const DATA_CATEGORIES: Array<{
  key: DataCategory;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    key: 'identities',
    label: 'Linked Identities',
    description: 'All your connected protocol accounts (Nostr, Farcaster, etc.)',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    key: 'bookmarks',
    label: 'Bookmarks',
    description: "Posts you've saved across all protocols",
    icon: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  },
  {
    key: 'follows',
    label: 'Follows',
    description: 'Who you follow and when you followed them',
    icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
  },
  {
    key: 'muted',
    label: 'Muted Users',
    description: 'Users you have muted',
    icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  },
  {
    key: 'mutedWords',
    label: 'Muted Words',
    description: 'Words and phrases you filter from your feed',
    icon: 'M3 3h18v18H3V3z',
  },
  {
    key: 'blocked',
    label: 'Blocked Users',
    description: 'Users you have blocked',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description: 'Your settings, theme, notification prefs, and more',
    icon: 'M12 15l-2 5 2-1 2 1-2-5zM12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24',
  },
  {
    key: 'mutedCommunities',
    label: 'Muted Communities',
    description: 'Communities you have muted',
    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
  },
  {
    key: 'blockedCommunities',
    label: 'Blocked Communities',
    description: 'Communities you have blocked',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
];

const HOSTED_INSTANCES = [
  {
    platform: 'Mastodon',
    url: 'https://social.degenfeed.xyz',
    icon: 'Mastodon',
    color: '#6364ff',
    description: 'Microblogging — follow creators, share posts, join conversations',
    compatible: 'Ice Cubes, Mastodon iOS/Android, Tusky, Fedilab',
  },
  {
    platform: 'Lemmy',
    url: 'https://community.degenfeed.xyz',
    icon: 'Lemmy',
    color: '#7c3aed',
    description: 'Link aggregation and discussion — communities around any topic',
    compatible: 'Jerboa, Thunder, Summit, Voyager',
  },
  {
    platform: 'PeerTube',
    url: 'https://video.degenfeed.xyz',
    icon: 'PeerTube',
    color: '#f1680d',
    description: 'Video hosting and sharing — decentralized YouTube alternative',
    compatible: 'NewPipe, LibreTube, PeerTube mobile web',
  },
];

/* === Skeletons ================================================= */

function _SectionSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-[var(--color-glass-border)]">
        <div className="h-5 w-48 skeleton rounded-lg" />
        <div className="mt-1 h-3 w-72 skeleton rounded-lg" />
      </div>
      <div className="p-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 skeleton rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* === Section Component ======================================== */

function DataSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden transition-all">
      {(title || subtitle) && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-glass-border)]">
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-degen-400">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={icon} />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--color-fg)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--color-muted)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* === Main Page ================================================= */

export default function DataPage() {
  const { primaryIdentity, linkedIdentities, signOut } = useAuth();
  const { showToast } = useToast();

  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [credExportState, setCredExportState] = useState<CredentialExportState>({
    status: 'idle',
  });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const [dataStats, setDataStats] = useState<Record<string, number> | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const displayName = primaryIdentity?.displayName ?? 'User';
  const hasIdentities = (primaryIdentity ? 1 : 0) + linkedIdentities.length > 0;

  /* === Load data stats ======================================= */

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        setLoadingStats(true);
        const identityId = primaryIdentity?.id ?? '';
        const [
          identities,
          bookmarks,
          follows,
          muted,
          mutedWords,
          blocked,
          mutedCommunities,
          blockedCommunities,
        ] = await Promise.all([
          getAllIdentities().catch(() => []),
          getBookmarks().catch(() => []),
          getFollows(identityId).catch(() => []),
          getMutedIdentities(identityId).catch(() => []),
          getMutedWords(identityId).catch(() => []),
          getBlockedUsers(identityId).catch(() => []),
          getMutedCommunities().catch(() => []),
          getBlockedCommunities().catch(() => []),
        ]);
        if (!cancelled) {
          setDataStats({
            identities: identities.length,
            bookmarks: bookmarks.length,
            follows: follows.length,
            muted: muted.length,
            mutedWords: mutedWords.length,
            blocked: blocked.length,
            mutedCommunities: mutedCommunities.length,
            blockedCommunities: blockedCommunities.length,
          });
        }
      } catch {
        /* stats are non-critical */
      }
      if (!cancelled) setLoadingStats(false);
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [primaryIdentity?.id]);

  /* === Collect all user data from IndexedDB ================== */

  const collectAllData = useCallback(async (): Promise<Record<string, unknown>> => {
    const identityId = primaryIdentity?.id ?? '';
    const [
      identities,
      bookmarks,
      follows,
      muted,
      mutedWords,
      blocked,
      mutedCommunities,
      blockedCommunities,
    ] = await Promise.all([
      getAllIdentities().catch(() => []),
      getBookmarks().catch(() => []),
      getFollows(identityId).catch(() => []),
      getMutedIdentities(identityId).catch(() => []),
      getMutedWords(identityId).catch(() => []),
      getBlockedUsers(identityId).catch(() => []),
      getMutedCommunities().catch(() => []),
      getBlockedCommunities().catch(() => []),
    ]);

    let preferences: Record<string, unknown> | null = null;
    try {
      if (primaryIdentity) {
        const prefs = await getPreferences(primaryIdentity.id);
        preferences = prefs as unknown as Record<string, unknown>;
      }
    } catch {
      /* non-critical */
    }

    return {
      exportedAt: new Date().toISOString(),
      source: 'DegenFeed',
      version: 2,
      summary: {
        identities: identities.length,
        bookmarks: bookmarks.length,
        follows: follows.length,
        mutedUsers: muted.length,
        mutedWords: mutedWords.length,
        blockedUsers: blocked.length,
        mutedCommunities: mutedCommunities.length,
        blockedCommunities: blockedCommunities.length,
      },
      primaryIdentity: primaryIdentity
        ? {
            id: primaryIdentity.id,
            protocol: primaryIdentity.protocol,
            publicId: primaryIdentity.publicId,
            handle: primaryIdentity.handle,
            displayName: primaryIdentity.displayName,
            linkedAt: primaryIdentity.linkedAt,
            verified: primaryIdentity.verified,
          }
        : null,
      linkedIdentities: linkedIdentities.map((i: StoredIdentity) => ({
        id: i.id,
        protocol: i.protocol,
        publicId: i.publicId,
        handle: i.handle,
        displayName: i.displayName,
        linkedAt: i.linkedAt,
        verified: i.verified,
      })),
      bookmarks: bookmarks.map(
        (b: {
          postId: unknown;
          title: unknown;
          authorName: unknown;
          protocol: unknown;
          savedAt: unknown;
          dfUri: unknown;
          tags?: unknown[];
        }) => ({
          postId: b.postId,
          title: b.title,
          authorName: b.authorName,
          protocol: b.protocol,
          savedAt: b.savedAt,
          dfUri: b.dfUri,
          tags: b.tags ?? [],
        }),
      ),
      follows: follows.map(
        (f: {
          identityId: unknown;
          targetId: unknown;
          targetProtocol: unknown;
          targetHandle: unknown;
          followedAt: unknown;
        }) => ({
          identityId: f.identityId,
          targetId: f.targetId,
          targetProtocol: f.targetProtocol,
          targetHandle: f.targetHandle,
          followedAt: f.followedAt,
        }),
      ),
      mutedUsers: muted.map(
        (m: { targetId: unknown; targetHandle: unknown; mutedAt: unknown }) => ({
          targetId: m.targetId,
          targetHandle: m.targetHandle,
          mutedAt: m.mutedAt,
        }),
      ),
      mutedWords: mutedWords.map((mw: { word: unknown; mutedAt: unknown }) => ({
        word: mw.word,
        mutedAt: mw.mutedAt,
      })),
      blockedUsers: blocked.map(
        (b: { targetId: unknown; targetHandle: unknown; blockedAt: unknown }) => ({
          targetId: b.targetId,
          targetHandle: b.targetHandle,
          blockedAt: b.blockedAt,
        }),
      ),
      mutedCommunities: mutedCommunities.map(
        (mc: {
          communityId: unknown;
          communityName: unknown;
          instance?: unknown;
          mutedAt: unknown;
        }) => ({
          communityId: mc.communityId,
          communityName: mc.communityName,
          instance: mc.instance ?? null,
          mutedAt: mc.mutedAt,
        }),
      ),
      blockedCommunities: blockedCommunities.map(
        (bc: {
          communityId: unknown;
          communityName: unknown;
          instance?: unknown;
          blockedAt: unknown;
        }) => ({
          communityId: bc.communityId,
          communityName: bc.communityName,
          instance: bc.instance ?? null,
          blockedAt: bc.blockedAt,
        }),
      ),
      preferences,
    };
  }, [primaryIdentity, linkedIdentities]);

  // Re-run data stats when primary identity changes
  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        setLoadingStats(true);
        const identityId = primaryIdentity?.id ?? '';
        const [
          identities,
          bookmarks,
          follows,
          muted,
          mutedWords,
          blocked,
          mutedCommunities,
          blockedCommunities,
        ] = await Promise.all([
          getAllIdentities().catch(() => []),
          getBookmarks().catch(() => []),
          getFollows(identityId).catch(() => []),
          getMutedIdentities(identityId).catch(() => []),
          getMutedWords(identityId).catch(() => []),
          getBlockedUsers(identityId).catch(() => []),
          getMutedCommunities().catch(() => []),
          getBlockedCommunities().catch(() => []),
        ]);
        if (!cancelled) {
          setDataStats({
            identities: identities.length,
            bookmarks: bookmarks.length,
            follows: follows.length,
            muted: muted.length,
            mutedWords: mutedWords.length,
            blocked: blocked.length,
            mutedCommunities: mutedCommunities.length,
            blockedCommunities: blockedCommunities.length,
          });
        }
      } catch {
        /* stats are non-critical */
      }
      if (!cancelled) setLoadingStats(false);
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [primaryIdentity]);

  /* === Collect portable credentials ========================== */

  const collectCredentials = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    const identities = await getAllIdentities().catch(() => [] as StoredIdentity[]);

    return identities
      .filter((i: StoredIdentity) => {
        // Only include protocols that have actual portable credentials
        const portableProtocols = [
          'nostr',
          'mastodon',
          'bluesky',
          'farcaster',
          'lens',
          'threads',
          'lemmy',
          'peertube',
        ];
        return portableProtocols.includes(i.protocol);
      })
      .map((i: StoredIdentity) => {
        const cred: Record<string, unknown> = {
          protocol: i.protocol,
          label: i.displayName || i.handle || i.protocol,
          publicKey: i.publicId,
          handle: i.handle,
        };

        // Extract portable credential fields from stored keys
        if (i.keys) {
          switch (i.protocol) {
            case 'nostr':
              cred.nsec = i.keys.nsec || null;
              break;
            case 'mastodon':
              cred.accessToken = i.keys.accessToken || null;
              cred.instance = 'social.degenfeed.xyz';
              break;
            case 'bluesky':
              cred.did = i.keys.did || null;
              cred.appPassword = i.keys.appPassword || null;
              break;
            case 'farcaster':
              cred.fid = i.keys.fid || null;
              cred.username = i.handle || null;
              cred.signerKey = i.keys.signerKey || null;
              break;
            case 'lens':
              cred.profileId = i.keys.lensProfileId || null;
              break;
            case 'lemmy':
              cred.accessToken = i.keys.accessToken || null;
              cred.instance = 'community.degenfeed.xyz';
              break;
            case 'peertube':
              cred.accessToken = i.keys.accessToken || null;
              cred.instance = 'video.degenfeed.xyz';
              break;
            case 'threads':
              cred.threadsId = i.keys.threadsDid || null;
              cred.accessToken = i.keys.accessToken || null;
              break;
          }
        }

        return cred;
      });
  }, []);

  /* === Export all data ======================================= */

  const handleExportAll = useCallback(async () => {
    setExportState({ status: 'collecting' });
    try {
      const data = await collectAllData();
      setExportState({ status: 'downloading' });

      const res = await fetch('/api/user/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, format: 'pretty' }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Export failed');
      }

      // Trigger file download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] || 'degenfeed-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportState({ status: 'done' });
      showToast('success', '✓ Your data has been downloaded');
      setTimeout(() => setExportState({ status: 'idle' }), 3000);
    } catch (err) {
      setExportState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Export failed',
      });
    }
  }, [collectAllData, showToast]);

  /* === Export credentials ==================================== */

  const handleExportCredentials = useCallback(async () => {
    setCredExportState({ status: 'preparing' });
    try {
      const credentials = await collectCredentials();
      setCredExportState({ status: 'downloading' });

      const res = await fetch('/api/user/export/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Credential export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] || 'degenfeed-credentials.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCredExportState({ status: 'done' });
      showToast('success', '✓ Portable credentials downloaded');
      setTimeout(() => setCredExportState({ status: 'idle' }), 3000);
    } catch (err) {
      setCredExportState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Credential export failed',
      });
    }
  }, [collectCredentials, showToast]);

  /* === Delete account ======================================== */

  const handleDeleteAccount = useCallback(async () => {
    setDeleteState({ status: 'deleting' });
    try {
      // Sign out — clears all local identities and server session
      await signOut();

      // Attempt server-side deletion
      try {
        await fetch('/api/user/delete', {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        /* server deletion is best-effort */
      }

      setDeleteState({ status: 'done' });
      // Redirect to home after brief delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setDeleteState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Account deletion failed',
      });
    }
  }, [signOut]);

  /* === Export single category ================================ */

  const handleExportCategory = useCallback(
    async (category: DataCategory) => {
      try {
        const identityId = primaryIdentity?.id ?? '';
        let data: unknown;
        switch (category) {
          case 'identities':
            data = await getAllIdentities();
            break;
          case 'bookmarks':
            data = await getBookmarks();
            break;
          case 'follows':
            data = await getFollows(identityId);
            break;
          case 'muted':
            data = await getMutedIdentities(identityId);
            break;
          case 'mutedWords':
            data = await getMutedWords(identityId);
            break;
          case 'blocked':
            data = await getBlockedUsers(identityId);
            break;
          case 'mutedCommunities':
            data = await getMutedCommunities();
            break;
          case 'blockedCommunities':
            data = await getBlockedCommunities();
            break;
          case 'preferences': {
            const identityId = primaryIdentity?.id;
            data = identityId ? await getPreferences(identityId) : null;
            break;
          }
          default:
            data = null;
        }

        const payload = {
          exportedAt: new Date().toISOString(),
          source: 'DegenFeed',
          category,
          data,
        };

        const res = await fetch('/api/user/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload, format: 'pretty' }),
        });

        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `degenfeed-${category}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('success', `✓ ${category} exported`);
      } catch {
        showToast('error', `Failed to export ${category}`);
      }
    },
    [primaryIdentity, showToast],
  );

  /* === Render ================================================ */

  const isExporting = exportState.status === 'collecting' || exportState.status === 'downloading';
  const isCredExporting =
    credExportState.status === 'preparing' || credExportState.status === 'downloading';

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-24 sm:pb-6">
        {/* ════════════════════════════════════════════════════════
            HEADER — Data Ownership Statement
        ════════════════════════════════════════════════════════ */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-degen-400"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Your Data</h1>
              <p className="text-sm text-[var(--color-muted)]">
                You own it. DegenFeed hosts it. You control it.
              </p>
            </div>
          </div>

          {/* Ownership Banner */}
          <div className="rounded-2xl border border-degen-500/20 bg-gradient-to-r from-degen-500/[0.05] via-purple-500/[0.03] to-transparent px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/10">
                <span className="text-lg">🔐</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-fg)]">
                  You own your data. Always.
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                  DegenFeed is built on the principle of data sovereignty. Your posts, follows,
                  bookmarks, and preferences belong to <strong>you</strong> — not us. We host this
                  data to provide the service, but you can export it at any time, take it to another
                  app, or delete it all. No lock-in, no fine print.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            DATA SUMMARY
        ════════════════════════════════════════════════════════ */}
        <DataSection
          title="What DegenFeed Stores"
          subtitle={`${primaryIdentity ? displayName : 'You'} have data across ${hasIdentities ? 'your connected accounts' : 'your account'}`}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        >
          {loadingStats ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 skeleton rounded-xl" />
              ))}
            </div>
          ) : dataStats ? (
            <div className="grid grid-cols-3 gap-2">
              {DATA_CATEGORIES.map((cat) => {
                const count = dataStats[cat.key] ?? 0;
                return (
                  <div
                    key={cat.key}
                    className="flex flex-col items-center rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2.5"
                  >
                    <span className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                      {count}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-center">
                      {cat.label.length > 12 ? `${cat.label.slice(0, 12)}…` : cat.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)] text-center py-2">
              Unable to load data summary
            </p>
          )}
        </DataSection>

        {/* ════════════════════════════════════════════════════════
            EXPORT SECTION
        ════════════════════════════════════════════════════════ */}
        <div className="mb-6 space-y-4">
          <DataSection
            title="Export Your Data"
            subtitle="Download everything or pick specific categories"
            icon="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
          >
            {/* Full export */}
            <div className="mb-4">
              <button
                type="button"
                onClick={handleExportAll}
                disabled={isExporting}
                className="w-full rounded-xl bg-gradient-to-r from-degen-500 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-degen-500/20 hover:shadow-degen-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {exportState.status === 'collecting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Collecting your data…
                  </span>
                ) : exportState.status === 'downloading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Downloading…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download All My Data (JSON)
                  </span>
                )}
              </button>
              {exportState.status === 'error' && (
                <p className="mt-2 text-xs text-red-400">{exportState.message}</p>
              )}
            </div>

            {/* Per-category export buttons */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--color-muted)] mb-2">
                Download individual categories:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {DATA_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleExportCategory(cat.key)}
                    disabled={isExporting}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3.5 py-2.5 text-left text-xs text-[var(--color-fg)] hover:border-degen-500/30 hover:bg-degen-500/5 transition-all disabled:opacity-50"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-degen-400"
                      aria-hidden="true"
                    >
                      <path d={cat.icon} />
                    </svg>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </DataSection>
        </div>

        {/* ════════════════════════════════════════════════════════
            PORTABLE CREDENTIALS
        ════════════════════════════════════════════════════════ */}
        <div className="mb-6 space-y-4">
          <DataSection
            title="Portable Credentials"
            subtitle="Your accounts work anywhere — download credentials for use on other apps"
            icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          >
            <div className="rounded-xl border border-degen-500/20 bg-degen-500/[0.03] px-4 py-3 mb-4">
              <div className="flex items-start gap-2.5">
                <span className="text-lg shrink-0">🔑</span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">
                    Your accounts on DegenFeed-hosted instances are fully portable
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)] leading-relaxed">
                    Use these credentials on any compatible app — Mastodon clients, Nostr apps,
                    Bluesky clients, and more. Your accounts on{' '}
                    <strong>social.degenfeed.xyz</strong>, <strong>community.degenfeed.xyz</strong>,
                    and <strong>video.degenfeed.xyz</strong> work with any standard-compatible
                    software. No lock-in, ever.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCredentials}
              disabled={isCredExporting}
              className="w-full rounded-xl border-2 border-degen-500/30 bg-degen-500/10 px-5 py-3 text-sm font-bold text-degen-400 hover:bg-degen-500/20 hover:border-degen-500/50 transition-all disabled:opacity-50"
            >
              {credExportState.status === 'preparing' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
                  Preparing credentials…
                </span>
              ) : credExportState.status === 'downloading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
                  Downloading…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Download Portable Credentials
                </span>
              )}
            </button>
            {credExportState.status === 'error' && (
              <p className="mt-2 text-xs text-red-400">{credExportState.message}</p>
            )}
          </DataSection>
        </div>

        {/* ════════════════════════════════════════════════════════
            LOGIN TO OTHER PLATFORMS
        ════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <DataSection
            title="Login to Other Platforms"
            subtitle="Use your DegenFeed-instance credentials on any compatible app"
            icon="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          >
            <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
              DegenFeed hosts decentralized social instances. Your account on each instance works
              with any app that supports that protocol. Here&apos;s what you can use:
            </p>

            <div className="space-y-3">
              {HOSTED_INSTANCES.map((instance) => (
                <div
                  key={instance.platform}
                  className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-4 hover:border-[var(--color-glass-border)]/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                      style={{ backgroundColor: `${instance.color}15`, color: instance.color }}
                    >
                      {instance.platform.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--color-fg)]">
                          {instance.platform}
                        </h3>
                        <a
                          href={instance.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs text-degen-400 hover:underline"
                        >
                          {instance.url.replace('https://', '')}
                        </a>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                        {instance.description}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                        <span className="font-medium text-[var(--color-fg)]">Compatible apps:</span>{' '}
                        {instance.compatible}
                      </p>
                    </div>
                    <a
                      href={instance.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-[var(--color-glass-border)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-degen-500/20 hover:text-degen-400 transition-colors"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </DataSection>
        </div>

        {/* ════════════════════════════════════════════════════════
            DATA PRIVACY FAQ
        ════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <DataSection
            title="Data Privacy FAQ"
            subtitle="What we collect, what we don't, and how you stay in control"
            icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          >
            <div className="space-y-4">
              {/* What we collect */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  What data does DegenFeed collect?
                </h4>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  DegenFeed stores only the data you explicitly create: your linked identities
                  (protocol accounts), posts and content you publish, follows, bookmarks, muted
                  users and words, blocked users, and preferences. This data is stored locally in
                  your browser and synced to our servers to provide the service.
                </p>
              </div>

              {/* What we DON'T collect */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  What data does DegenFeed <strong>NOT</strong> collect?
                </h4>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  We do not collect your browsing history, sell your data to advertisers, track you
                  across websites, store your private keys in plaintext, or access your connected
                  protocol accounts beyond what you explicitly authorize. We do not have a
                  &ldquo;data monetization&rdquo; model because there is no data to monetize — it
                  belongs to you.
                </p>
              </div>

              {/* How to export */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  How do I export my data?
                </h4>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Click the &ldquo;Download All My Data&rdquo; button above. You&apos;ll receive a
                  JSON file containing all your DegenFeed data — identities, bookmarks, follows,
                  muted users, preferences, and more. You can also download individual categories.
                  Your data is yours to keep, move, or delete.
                </p>
              </div>

              {/* How to delete */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  How do I delete my data?
                </h4>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Click the &ldquo;Delete Account&rdquo; button below. This removes all your data
                  from DegenFeed&apos;s servers and clears your local storage. Note: data published
                  to external protocols (Nostr relays, Farcaster hubs, Bluesky PDS, etc.) is
                  governed by those protocols&apos; own deletion policies and cannot be deleted by
                  DegenFeed.
                </p>
              </div>

              {/* Portability */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  Can I use my DegenFeed credentials on other apps?
                </h4>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Absolutely. Your accounts on DegenFeed-hosted instances (
                  <code className="text-degen-400 text-[11px]">social.degenfeed.xyz</code>,{' '}
                  <code className="text-degen-400 text-[11px]">community.degenfeed.xyz</code>,{' '}
                  <code className="text-degen-400 text-[11px]">video.degenfeed.xyz</code>) are
                  standard Mastodon, Lemmy, and PeerTube accounts respectively. Use the
                  &ldquo;Download Portable Credentials&rdquo; button to get your credentials, then
                  sign into any compatible app. Your Nostr nsec works with any Nostr client. Your
                  Bluesky credentials work with any Bluesky client. No lock-in, ever.
                </p>
              </div>

              {/* Encryption */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  How are my private keys stored?
                </h4>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Private keys (like Nostr nsec) are encrypted at rest using AES-256-GCM with a key
                  derived from your passphrase via Argon2id. We never store keys in plaintext. When
                  you export your credentials, you&apos;re downloading the decrypted keys that you
                  already control. For wallet-based protocols (Ethereum, Solana), no private keys
                  are ever stored — we use standard wallet signatures.
                </p>
              </div>
            </div>
          </DataSection>
        </div>

        {/* ════════════════════════════════════════════════════════
            DANGER ZONE — DELETE ACCOUNT
        ════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <DataSection
            title="Danger Zone"
            subtitle="Irreversible actions — proceed with caution"
            icon="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          >
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-red-400"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-red-400">Delete Account</h4>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)] leading-relaxed">
                    Permanently remove all your data from DegenFeed. This deletes your identities,
                    bookmarks, follows, preferences, and all stored data. Your posts on external
                    protocols (Nostr, Farcaster, Bluesky, etc.) remain on those networks as they are
                    governed by their own protocols.
                  </p>

                  {deleteState.status === 'confirming' ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-red-400">
                        Are you absolutely sure? This cannot be undone. Export your data first if
                        you want to keep it.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={(deleteState.status as string) === 'deleting'}
                          className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          {(deleteState.status as string) === 'deleting' ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                              Deleting…
                            </span>
                          ) : (
                            'Yes, delete everything'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteState({ status: 'idle' })}
                          className="flex-1 rounded-lg bg-[var(--color-overlay)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : deleteState.status === 'done' ? (
                    <div className="mt-3 rounded-lg bg-degen-500/10 px-4 py-3">
                      <p className="text-xs font-medium text-degen-400">
                        ✓ Account deleted. Redirecting…
                      </p>
                    </div>
                  ) : deleteState.status === 'error' ? (
                    <div className="mt-3">
                      <p className="text-xs text-red-400">{deleteState.message}</p>
                      <button
                        type="button"
                        onClick={() => setDeleteState({ status: 'idle' })}
                        className="mt-2 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteState({ status: 'confirming' })}
                      className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Delete my account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DataSection>
        </div>

        {/* ════════════════════════════════════════════════════════
            FOOTER — Data sovereignty reminder
        ════════════════════════════════════════════════════════ */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-degen-500/10 px-4 py-2">
            <span className="text-sm">🔐</span>
            <span className="text-xs font-medium text-degen-400">
              You own your data. Always have, always will.
            </span>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

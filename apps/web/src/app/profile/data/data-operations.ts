'use client';

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
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';
import type { CredentialExportState, DeleteState, ExportState } from './types';

export function useDataPage() {
  const { primaryIdentity, linkedIdentities, signOut } = useAuth();
  const { showToast } = useToast();

  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [credExportState, setCredExportState] = useState<CredentialExportState>({ status: 'idle' });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const [dataStats, setDataStats] = useState<Record<string, number> | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const displayName = primaryIdentity?.displayName ?? 'User';
  const hasIdentities = (primaryIdentity ? 1 : 0) + linkedIdentities.length > 0;

  // Load data stats
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

  // Collect all data
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

  // Collect portable credentials
  const collectCredentials = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    const identities = await getAllIdentities().catch(() => [] as StoredIdentity[]);
    return identities
      .filter((i: StoredIdentity) =>
        [
          'nostr',
          'mastodon',
          'bluesky',
          'farcaster',
          'lens',
          'threads',
          'lemmy',
          'peertube',
        ].includes(i.protocol),
      )
      .map((i: StoredIdentity) => {
        const cred: Record<string, unknown> = {
          protocol: i.protocol,
          label: i.displayName || i.handle || i.protocol,
          publicKey: i.publicId,
          handle: i.handle,
        };
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

  // Export all data
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

  // Export credentials
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

  // Delete account
  const handleDeleteAccount = useCallback(async () => {
    setDeleteState({ status: 'deleting' });
    try {
      await signOut();
      try {
        await fetch('/api/user/delete', { method: 'POST', credentials: 'include' });
      } catch {
        /* best-effort */
      }
      setDeleteState({ status: 'done' });
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

  // Export single category
  const handleExportCategoryFn = useCallback(
    async (category: string) => {
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
            const id = primaryIdentity?.id;
            data = id ? await getPreferences(id) : null;
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

  return {
    primaryIdentity,
    linkedIdentities,
    displayName,
    hasIdentities,
    exportState,
    credExportState,
    deleteState,
    dataStats,
    loadingStats,
    setDeleteState,
    handleExportAll,
    handleExportCredentials,
    handleDeleteAccount,
    handleExportCategory: handleExportCategoryFn,
  };
}

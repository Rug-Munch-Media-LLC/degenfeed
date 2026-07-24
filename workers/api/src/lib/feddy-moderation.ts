import type { Env } from '../index';
import { removeCommunityMember } from './feddy-community';
import { getStore, k } from './feddy-constants';
import type { Appeal, FedBlocklistEntry, KeywordFilter, ModLogEntry, Report } from './feddy-types';

export async function banMember(env: Env, communityId: string, wallet: string): Promise<boolean> {
  try {
    const removed = await removeCommunityMember(env, communityId, wallet);
    if (!removed) return false;

    const store = getStore(env);
    const banKey = k('feddy', 'banned', communityId);
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

export async function unbanMember(env: Env, communityId: string, wallet: string): Promise<boolean> {
  try {
    const store = getStore(env);
    const banKey = k('feddy', 'banned', communityId);
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

export async function isBanned(env: Env, communityId: string, wallet: string): Promise<boolean> {
  try {
    const banKey = k('feddy', 'banned', communityId);
    const raw = await getStore(env).get(banKey);
    if (!raw) return false;
    const banned: string[] = JSON.parse(raw);
    return banned.includes(wallet);
  } catch {
    return false;
  }
}

// ─── Events ────────────────────────────────────────────────────────────

export async function addModLogEntry(env: Env, entry: ModLogEntry): Promise<void> {
  const store = getStore(env);
  const key = k('feddy', 'mod-log', entry.communityId, String(entry.createdAt), entry.id);
  const indexKey = k('feddy', 'mod-log-index', entry.communityId);

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

export async function getModLog(env: Env, communityId: string, limit = 50): Promise<ModLogEntry[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'mod-log-index', communityId);
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw).slice(0, limit);

    const entries: ModLogEntry[] = [];
    for (const id of ids) {
      // Scan for entry (we don't have the timestamp prefix)
      const _prefix = k('feddy', 'mod-log', communityId);
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
    const indexKey = k('feddy', 'mod-log-index', communityId);
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
  const key = k('feddy', 'reports', report.communityId, report.id);
  const indexKey = k('feddy', 'reports-index', report.communityId);

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

export async function getReports(env: Env, communityId: string, limit = 20): Promise<Report[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'reports-index', communityId);
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw).slice(0, limit);

    const reports: Report[] = [];
    for (const id of ids) {
      const reportRaw = await store.get(k('feddy', 'reports', communityId, id));
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
  status: Report['status'],
  resolvedBy?: string,
  resolution?: string,
): Promise<boolean> {
  try {
    const key = k('feddy', 'reports', communityId, reportId);
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
  const key = k('feddy', 'appeals', appeal.communityId, appeal.id);
  const indexKey = k('feddy', 'appeals-index', appeal.communityId);
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

export async function getAppeals(env: Env, communityId: string): Promise<Appeal[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'appeals-index', communityId);
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);

    const appeals: Appeal[] = [];
    for (const id of ids) {
      const appealRaw = await store.get(k('feddy', 'appeals', communityId, id));
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
  status: 'granted' | 'denied',
  reviewedBy?: string,
  reviewNote?: string,
): Promise<boolean> {
  try {
    const key = k('feddy', 'appeals', communityId, appealId);
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
  await getStore(env).put(k('feddy', 'keyword-filters', communityId), JSON.stringify(filters));
}

export async function getKeywordFilters(env: Env, communityId: string): Promise<KeywordFilter[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'keyword-filters', communityId));
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
        return new RegExp(f.pattern, 'i').test(text);
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
  await getStore(env).put(k('feddy', 'link-blocklist', communityId), JSON.stringify(domains));
}

export async function getLinkBlocklist(env: Env, communityId: string): Promise<string[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'link-blocklist', communityId));
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
  const key = k('feddy', 'fed-blocklist', communityId);
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
    const key = k('feddy', 'fed-blocklist', communityId);
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

export async function getFedBlocklist(env: Env, communityId: string): Promise<FedBlocklistEntry[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'fed-blocklist', communityId));
    return raw ? (JSON.parse(raw) as FedBlocklistEntry[]) : [];
  } catch {
    return [];
  }
}

import type { Env } from '../index';
import { k, getStore, ROLE_HIERARCHY } from './feddy-constants';
import type { FeddyCommunity, CommunityMember, MemberRole, CommunityPost } from './feddy-types';

export async function createCommunity(env: Env, community: FeddyCommunity): Promise<void> {
  const store = getStore(env);
  await Promise.all([
    store.put(k('feddy', community.id), JSON.stringify(community)),
    store.put(k('feddy', 'by-name', community.name), community.id),
    store.put(
      k('feddy', 'members', community.id),
      JSON.stringify([
        {
          wallet: community.owner,
          role: 'owner' as MemberRole,
          joinedAt: community.createdAt,
        },
      ]),
    ),
    store.put(k('feddy', 'directory', 'index'), community.id, {
      metadata: { method: 'append' },
    }),
    store.put(k('feddy', 'directory', 'by-category', community.category), community.id, {
      metadata: { method: 'append' },
    }),
    store.put(k('feddy', 'feed', community.id), JSON.stringify([])),
    store.put(k('feddy', 'pinned', community.id), JSON.stringify([])),
    // Update autocomplete index
    ...community.name.split('').map((_, i) =>
      store.put(k('feddy', 'autocomplete', community.name.slice(0, i + 1)), community.id, {
        metadata: { method: 'append' },
      }),
    ),
  ]);
}

export async function getCommunityById(env: Env, id: string): Promise<FeddyCommunity | null> {
  try {
    const raw = await getStore(env).get(k('feddy', id));
    return raw ? (JSON.parse(raw) as FeddyCommunity) : null;
  } catch {
    return null;
  }
}

export async function getCommunityByName(env: Env, name: string): Promise<FeddyCommunity | null> {
  try {
    const store = getStore(env);
    const id = await store.get(k('feddy', 'by-name', name.toLowerCase()));
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
  await store.put(k('feddy', id), JSON.stringify(updated));

  if (updates.category && updates.category !== community.category) {
    await store.put(k('feddy', 'directory', 'by-category', updates.category), id, {
      metadata: { method: 'append' },
    });
  }

  return updated;
}

export async function deleteCommunity(env: Env, id: string): Promise<boolean> {
  const community = await getCommunityById(env, id);
  if (!community) return false;

  const store = getStore(env);
  await Promise.all([
    store.delete(k('feddy', id)),
    store.delete(k('feddy', 'by-name', community.name)),
    store.delete(k('feddy', 'members', id)),
    store.delete(k('feddy', 'feed', id)),
    store.delete(k('feddy', 'pinned', id)),
    store.delete(k('feddy', 'stats', id)),
    store.delete(k('feddy', 'events', id, 'index')),
    store.delete(k('feddy', 'polls', id, 'index')),
    store.delete(k('feddy', 'wiki', id)),
    store.delete(k('feddy', 'badges', id)),
    store.delete(k('feddy', 'treasury', id)),
    store.delete(k('feddy', 'token-config', id)),
    store.delete(k('feddy', 'token-gates', id)),
    store.delete(k('feddy', 'keyword-filters', id)),
    store.delete(k('feddy', 'link-blocklist', id)),
    store.delete(k('feddy', 'fed-blocklist', id)),
    store.delete(k('feddy', 'federation-health', id)),
  ]);
  return true;
}

// ─── Name reservation ───────────────────────────────────────────────────

export async function reserveName(env: Env, name: string, wallet: string): Promise<boolean> {
  try {
    const key = k('feddy', 'name-reservation', name);
    const existing = await getStore(env).get(key);
    if (existing) {
      const reservation = JSON.parse(existing) as { wallet: string };
      if (reservation.wallet !== wallet) return false;
    }
    await getStore(env).put(key, JSON.stringify({ wallet, reservedAt: Date.now() }), {
      expirationTtl: 600,
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseName(env: Env, name: string): Promise<void> {
  try {
    await getStore(env).delete(k('feddy', 'name-reservation', name));
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
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
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
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
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
  role: MemberRole = 'member',
): Promise<boolean> {
  try {
    const key = k('feddy', 'members', communityId);
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
    const key = k('feddy', 'members', communityId);
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
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
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
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
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
    const key = k('feddy', 'members', communityId);
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
    const key = k('feddy', 'members', communityId);
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
    const key = k('feddy', 'members', communityId);
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
  return role === 'owner' || role === 'moderator';
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

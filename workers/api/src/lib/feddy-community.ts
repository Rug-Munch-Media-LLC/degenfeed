import type { Env } from '../types';
import { getStore, k, ROLE_HIERARCHY } from './feddy-constants';
import type { CommunityMember, FeddyCommunity, MemberRole } from './feddy-types';

export async function createCommunity(env: Env, community: FeddyCommunity): Promise<void> {

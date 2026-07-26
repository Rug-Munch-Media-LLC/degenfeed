import type { Env } from '../types';
import { removeCommunityMember } from './feddy-community';
import { getStore, k } from './feddy-constants';
import type { Appeal, FedBlocklistEntry, KeywordFilter, ModLogEntry, Report } from './feddy-types';

export async function banMember(env: Env, communityId: string, wallet: string): Promise<boolean> {

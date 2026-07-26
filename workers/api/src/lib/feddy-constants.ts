import type { Env } from '../types';
import type { FeddyCategory, MemberRole, ReportCategory } from './feddy-types';

export const VALID_CATEGORIES: FeddyCategory[] = [
  'crypto',
  'tech',
  'art',
  'music',
  'gaming',
  'sports',
  'food',
  'travel',
  'fashion',
  'health',
  'education',
  'finance',
  'science',
  'literature',
  'film',
  'general',
];

export const VALID_CATEGORIES_SET = new Set<string>(VALID_CATEGORIES);

export const CATEGORY_META: Record<FeddyCategory, { emoji: string; label: string }> = {

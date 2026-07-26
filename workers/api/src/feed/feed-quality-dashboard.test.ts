/**
 * Tests for Feed Quality Dashboard
 */

import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { buildQualityDashboard } from './feed-quality-dashboard';

function makePost(id: string, overrides: Partial<UnifiedPost> = {}): UnifiedPost {

describe('buildQualityDashboard', () => {


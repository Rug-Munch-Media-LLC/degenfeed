/** Types for the SSO Bridge module. */
import type { Env } from '../../index';
export interface SSOProtocolDef { id: string; label: string; instanceUrl: string; apiEndpoint: string; healthEndpoint: string; icon: string; color: string; category: 'social' | 'video' | 'music' | 'blog' | 'events' | 'podcast' | 'books' | 'live'; requiresPremium: boolean; }
export interface SSOAccountState { protocol: string; registered: boolean; username: string | null; profileUrl: string | null; avatarUrl?: string; lastActive: number | null; createdAt: number | null; error?: string; }
export interface SSOWalletState { wallet: string; accounts: SSOAccountState[]; masterSessionId: string | null; lastActive: number; provisionedAt: number; }
export interface SSOSession { sessionId: string; wallet: string; protocols: string[]; createdAt: number; expiresAt: number; lastUsed: number; issuedAt: number; }
export interface SSOExportBundle { wallet: string; accounts: SSOAccountState[]; masterSessionId: string; exportedAt: number; }
export interface SSOProvisioningResult { protocol: string; ok: boolean; username?: string; profileUrl?: string; error?: string; }
export interface SSOSessionPayload { sub: string; wallet: string; sessionId: string; protocols: string[]; iat: number; exp: number; }

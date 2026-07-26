/**
 * @degenfeed/api-worker — Platform OAuth Token Exchange Functions
 */

import type { Env } from '../../types';

export async function exchangeRedditCode(
  code: string, env: Env, redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; platformUserId: string; label: string; expiresAt?: number; metadata?: Record<string, string> } | Response> {

export async function exchangeMediumCode(
  code: string, env: Env, redirectUri: string,
): Promise<{ accessToken: string; platformUserId: string; label: string } | Response> {

export async function exchangeGoogleCode(
  code: string, env: Env, redirectUri: string, _platform: string,
): Promise<{ accessToken: string; refreshToken?: string; platformUserId: string; label: string; expiresAt?: number; metadata?: Record<string, string> } | Response> {

export async function exchangeLinkedInCode(
  code: string, env: Env, redirectUri: string,
): Promise<{ accessToken: string; platformUserId: string; label: string; expiresAt?: number } | Response> {

export async function exchangeInstagramCode(
  code: string, env: Env, redirectUri: string,
): Promise<{ accessToken: string; platformUserId: string; label: string; expiresAt?: number } | Response> {

export async function exchangePinterestCode(
  code: string, env: Env, redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; platformUserId: string; label: string; expiresAt?: number } | Response> {

export async function exchangeTikTokCode(
  code: string, env: Env, redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; platformUserId: string; label: string; expiresAt?: number } | Response> {

async function handleTokenError(platform: string, resp: Response): Promise<Response> {


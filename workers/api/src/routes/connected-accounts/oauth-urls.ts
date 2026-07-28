/**
 * @degenfeed/api-worker — Platform OAuth URL Builders
 */

import { jsonResponse } from '../../response-helpers';
import type { Env } from '../../types';

export function buildMediumOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.MEDIUM_CLIENT_ID || '';
  const scopes = encodeURIComponent('basicProfile,publishPost');
  return (
    `https://medium.com/m/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

export function buildYouTubeOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.YOUTUBE_API_KEY || '';
  const scopes = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly');
  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}&` +
    `access_type=offline&` +
    `prompt=consent`
  );
}

export function buildLinkedInOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.LINKEDIN_CLIENT_ID || '';
  const scopes = encodeURIComponent('openid profile email w_member_social');
  return (
    `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `scope=${scopes}`
  );
}

export function buildInstagramOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const appId = env.INSTAGRAM_APP_ID || '';
  const scopes = encodeURIComponent('instagram_basic,instagram_content_publish,pages_read_engagement');
  return (
    `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${appId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

export function buildRedditOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.REDDIT_CLIENT_ID || '';
  const scopes = encodeURIComponent('identity,submit,read');
  return (
    `https://www.reddit.com/api/v1/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `duration=permanent&` +
    `scope=${scopes}`
  );
}

export function buildPinterestOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.PINTEREST_CLIENT_ID || '';
  const scopes = encodeURIComponent('boards:read,pins:read,pins:write');
  return (
    `https://www.pinterest.com/oauth/?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

export function buildTikTokOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientKey = env.TIKTOK_CLIENT_KEY || '';
  const scopes = encodeURIComponent('user.info.basic,video.publish');
  return (
    `https://www.tiktok.com/auth/authorize?` +
    `client_key=${clientKey}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

export function buildSubstackOAuthUrl(): { note: string; manual: boolean; platform: string } {
  return {
    note: 'Substack has no public OAuth API. Use the /api/accounts/connect/substack/email endpoint instead.',
    manual: true,
    platform: 'substack',
  };
}

export function buildOAuthUrl(
  env: Env,
  platform: string,
  state: string,
  redirectUri: string,
): Response | string {
  switch (platform) {
    case 'medium':
      return buildMediumOAuthUrl(env, state, redirectUri);
    case 'youtube':
      return buildYouTubeOAuthUrl(env, state, redirectUri);
    case 'linkedin':
      return buildLinkedInOAuthUrl(env, state, redirectUri);
    case 'instagram':
      return buildInstagramOAuthUrl(env, state, redirectUri);
    case 'reddit':
      return buildRedditOAuthUrl(env, state, redirectUri);
    case 'pinterest':
      return buildPinterestOAuthUrl(env, state, redirectUri);
    case 'tiktok':
      return buildTikTokOAuthUrl(env, state, redirectUri);
    case 'substack':
      return jsonResponse(buildSubstackOAuthUrl());
    default:
      return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
  }
}

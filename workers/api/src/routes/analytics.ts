import { type Env, jsonResponse } from '../index';

export async function handleAnalytics(request: Request, env: Env): Promise<Response> {
  // Return mock analytics data for now — real data pipeline comes later
  return jsonResponse({
    followers: { total: 0, byProtocol: {}, growth30d: [], growthLabels: [] },
    posts: { total: 0, byDay: [], dayLabels: [], byWeekday: [], weekdayLabels: [] },
    tips: { totalUsd: 0, byCurrency: {}, history30d: [], historyLabels: [] },
    engagement: { rate: 0, totalLikes: 0, totalReposts: 0, totalReplies: 0 },
    topPosts: [],
    topTipPosts: [],
    audience: { byInstance: {}, locations: {} },
  });
}

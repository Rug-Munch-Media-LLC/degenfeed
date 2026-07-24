'use client';

import { useCallback } from 'react';
import type { AnalyticsData } from './types';

export function useCsvExport(data: AnalyticsData) {
  return useCallback(() => {
    const rows: string[][] = [];
    rows.push(['Section', 'Metric', 'Value']);
    rows.push(['Overview', 'Total Followers', String(data.followers.total)]);
    rows.push(['Overview', 'Total Posts', String(data.posts.total)]);
    rows.push(['Overview', 'Total Tips (USD)', String(data.tips.totalUsd)]);
    rows.push(['Overview', 'Engagement Rate', String(data.engagement.rate)]);
    for (const [protocol, count] of Object.entries(data.followers.byProtocol)) {
      rows.push(['Followers by Protocol', protocol, String(count)]);
    }
    for (const [currency, amount] of Object.entries(data.tips.byCurrency)) {
      rows.push(['Tips by Currency', currency, String(amount)]);
    }
    rows.push(['', '', '']);
    rows.push(['Top Posts', 'Content', 'Likes', 'Reposts', 'Replies', 'Tips (USD)']);
    for (const post of data.topPosts) {
      rows.push([
        'Top Posts',
        post.content,
        String(post.likes),
        String(post.reposts),
        String(post.replies),
        String(post.tipsUsd),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `degenfeed-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);
}

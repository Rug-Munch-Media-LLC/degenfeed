'use client';

import { getCategoryInfo, type ScheduleType } from './types';

interface StreamScheduleProps {
  streams?: ScheduleType[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;

  if (diff < 0) return 'Starting soon';
  if (diff < 3600000) return `In ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `In ${Math.floor(diff / 3600000)}h`;
  if (diff < 86400000 * 7) {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function StreamSchedule({ streams }: StreamScheduleProps) {
  const schedule = streams ?? [];

  if (schedule.length === 0) return null;

  return (
    <section
      aria-label="Upcoming streams"
      className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-white/50"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h3 className="text-sm font-semibold text-white/90">Schedule</h3>
      </div>
      <div className="divide-y divide-white/5">
        {schedule.map((s) => {
          const cat = getCategoryInfo(s.category);
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm"
                style={{ color: cat.color }}
              >
                {cat.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/80">{s.title}</p>
                {s.description && (
                  <p className="truncate text-[10px] text-white/40">{s.description}</p>
                )}
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium"
                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
              >
                {formatDate(s.scheduledAt)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

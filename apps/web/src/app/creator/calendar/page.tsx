'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'week' | 'day';

interface CalendarEntry {
  id: string;
  masterPost: {
    text: string;
    title?: string;
    hashtags?: string[];
  };
  protocols: string[];
  scheduledAt: string | null;
  status: string;
  isEvergreen?: boolean;
  recurrence?: string;
  aiOptimized?: boolean;
  autoThread?: boolean;
}

interface CalendarDayData {
  date: string;
  entries: CalendarEntry[];
  count: number;
}

interface CalendarResponse {
  calendar: CalendarDayData[];
  stats: {
    scheduled: number;
    queued: number;
    published: number;
    evergreen: number;
    total: number;
  };
}

interface TimeSuggestion {
  dayOfWeek: number;
  hourUTC: number;
  score: number;
  label: string;
  dayName: string;
  timeFormatted: string;
}

// ─── Platform Colors ──────────────────────────────────────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  mastodon: '#6364ff',
  bluesky: '#1185fe',
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  threads: '#101010',
  reddit: '#ff4500',
  telegram: '#0088cc',
  discord: '#5865f2',
  lemmy: '#4a8c6f',
  peertube: '#f2691d',
  pixelfed: '#005cff',
};

const PROTOCOL_ICONS: Record<string, string> = {
  mastodon: '🐘',
  bluesky: '🦋',
  nostr: '⚡',
  farcaster: '◈',
  lens: '🌿',
  threads: '⊞',
  reddit: '🤖',
  telegram: '✈️',
  discord: '💬',
  lemmy: '🔮',
  peertube: '▶️',
  pixelfed: '📷',
};

// ─── Calendar Component ───────────────────────────────────────────────────

export default function CalendarPage() {
  const { walletAddress } = useAuth();
  const { showToast } = useToast();

  // ── Navigation ──
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<TimeSuggestion[]>([]);
  const [draggedEntry, setDraggedEntry] = useState<CalendarEntry | null>(null);
  const [showQuickSchedule, setShowQuickSchedule] = useState(false);
  const [quickScheduleText, setQuickScheduleText] = useState('');
  const [showAIGapFill, setShowAIGapFill] = useState(false);

  // ── Calendar Navigation ──
  const viewStart = useMemo(() => getViewStart(currentDate, view), [currentDate, view]);
  const viewEnd = useMemo(() => getViewEnd(viewStart, view), [viewStart, view]);

  const monthLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekLabel = useMemo(() => {
    const start = viewStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [viewStart]);

  const dayLabel = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // ── Fetch Calendar Data ──
  const fetchCalendar = useCallback(async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const startStr = viewStart.toISOString().split('T')[0] ?? '';
      const endStr = viewEnd.toISOString().split('T')[0] ?? '';

      const [calRes, timesRes] = await Promise.all([
        fetch(`/api/premium/calendar?start=${startStr}&end=${endStr}`, {
          credentials: 'include',
        }),
        fetch('/api/premium/best-times?protocols=mastodon,bluesky,nostr', {
          credentials: 'include',
        }),
      ]);

      if (calRes.ok) {
        const calData = (await calRes.json()) as CalendarResponse;
        setCalendarData(calData);
      }

      if (timesRes.ok) {
        const timesData = (await timesRes.json()) as { bestTimes: TimeSuggestion[] };
        setAiSuggestions(timesData.bestTimes ?? []);
      }
    } catch {
      showToast('error', 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, viewStart, viewEnd, showToast]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // ── Navigation Handlers ──
  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === 'month') next.setMonth(next.getMonth() + 1);
      else if (view === 'week') next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 1);
      return next;
    });
  }, [view]);

  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      const prev = new Date(d);
      if (view === 'month') prev.setMonth(prev.getMonth() - 1);
      else if (view === 'week') prev.setDate(prev.getDate() - 7);
      else prev.setDate(prev.getDate() - 1);
      return prev;
    });
  }, [view]);

  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  // ── Drag & Drop ──
  const handleDragStart = useCallback((entry: CalendarEntry) => {
    setDraggedEntry(entry);
  }, []);

  const handleDrop = useCallback(
    async (targetDate: string) => {
      if (!draggedEntry) return;

      try {
        const res = await fetch(`/api/premium/queue/${draggedEntry.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledAt: new Date(`${targetDate}T12:00:00Z`).toISOString(),
          }),
        });

        if (res.ok) {
          showToast('success', `Rescheduled to ${targetDate}`);
          fetchCalendar();
        } else {
          const err = (await res.json()) as { error?: string };
          showToast('error', err.error ?? 'Failed to reschedule');
        }
      } catch {
        showToast('error', 'Failed to reschedule');
      }

      setDraggedEntry(null);
    },
    [draggedEntry, fetchCalendar, showToast],
  );

  // ── Quick Schedule ──
  const handleQuickSchedule = useCallback(async () => {
    if (!quickScheduleText.trim()) return;

    try {
      const res = await fetch('/api/premium/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPost: { text: quickScheduleText.trim() },
          protocols: ['mastodon', 'bluesky', 'nostr'],
          aiOptimize: true,
        }),
      });

      if (res.ok) {
        showToast('success', 'Post queued with AI-optimized time');
        setQuickScheduleText('');
        setShowQuickSchedule(false);
        fetchCalendar();
      } else {
        const err = (await res.json()) as { error?: string };
        showToast('error', err.error ?? 'Failed to queue');
      }
    } catch {
      showToast('error', 'Failed to queue post');
    }
  }, [quickScheduleText, fetchCalendar, showToast]);

  // ── Get entries for a specific date ──
  const getEntriesForDate = useCallback(
    (dateStr: string): CalendarEntry[] => {
      if (!calendarData) return [];
      const day = calendarData.calendar.find((d) => d.date === dateStr);
      return day?.entries ?? [];
    },
    [calendarData],
  );

  // ── Check if a date has AI gaps ──
  const getGapDays = useCallback((): string[] => {
    if (!calendarData) return [];

    const gaps: string[] = [];
    const entriesByDate = new Map(calendarData.calendar.map((d) => [d.date, d.entries]));

    let streak = 0;
    for (const day of calendarData.calendar) {
      const entries = entriesByDate.get(day.date) ?? [];
      if (entries.length === 0) {
        streak++;
        if (streak >= 3) gaps.push(day.date);
      } else {
        streak = 0;
      }
    }

    return gaps;
  }, [calendarData]);

  // ── Render ──
  if (!walletAddress) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-[var(--color-muted)]">
            Connect your wallet to access the Content Calendar
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Premium feature requires Pro tier or higher
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Content Calendar</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Schedule, manage, and optimize your cross-posts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Gap Fill */}
          {getGapDays().length > 0 && (
            <button
              type="button"
              onClick={() => setShowAIGapFill(!showAIGapFill)}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              🤖 {getGapDays().length} gap{getGapDays().length > 1 ? 's' : ''} detected
            </button>
          )}

          {/* Quick Schedule */}
          <button
            type="button"
            onClick={() => setShowQuickSchedule(!showQuickSchedule)}
            className="btn-primary text-sm"
          >
            + Quick Schedule
          </button>
        </div>
      </div>

      {/* Quick Schedule Popup */}
      {showQuickSchedule && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--color-fg)]">Quick Schedule Post</h3>
          <textarea
            value={quickScheduleText}
            onChange={(e) => setQuickScheduleText(e.target.value)}
            placeholder="Type your post content..."
            rows={3}
            className="mb-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-muted)]">
              AI will find the best posting time ✨
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowQuickSchedule(false)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickSchedule}
                disabled={!quickScheduleText.trim()}
                className="btn-primary text-xs disabled:opacity-40"
              >
                Schedule with AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Gap Fill */}
      {showAIGapFill && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-amber-400">AI Gap Fill Suggestions</h3>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            You have {getGapDays().length} gap{getGapDays().length > 1 ? 's' : ''} where no content
            is scheduled for 3+ days. Consider scheduling posts on these dates:
          </p>
          <div className="flex flex-wrap gap-2">
            {getGapDays()
              .slice(0, 5)
              .map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setCurrentDate(new Date(`${date}T12:00:00Z`));
                    setView('day');
                    setShowAIGapFill(false);
                  }}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 transition-colors hover:bg-amber-500/20"
                >
                  📅{' '}
                  {new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </button>
              ))}
          </div>

          {/* AI Time Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="mt-3 border-t border-amber-500/10 pt-3">
              <p className="mb-2 text-xs font-medium text-amber-400">
                Best Posting Times (AI-optimized)
              </p>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.map((suggestion, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400"
                  >
                    ⏰ {suggestion.dayName} {suggestion.timeFormatted}
                    <span className="ml-1 text-[10px] opacity-60">
                      ({(suggestion.score * 100).toFixed(0)}%)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Bar */}
      {calendarData && (
        <div className="flex flex-wrap gap-4">
          <StatCard label="Scheduled" value={calendarData.stats.scheduled} color="#6364ff" />
          <StatCard label="Queued" value={calendarData.stats.queued} color="#8e30eb" />
          <StatCard label="Published" value={calendarData.stats.published} color="#00ff41" />
          <StatCard label="Evergreen" value={calendarData.stats.evergreen} color="#f2691d" />
        </div>
      )}

      {/* View Controls + Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg px-2 py-1 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg px-2 py-1 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          >
            →
          </button>
          <span className="ml-2 text-sm font-medium text-[var(--color-fg)]">
            {view === 'month' ? monthLabel : view === 'week' ? weekLabel : dayLabel}
          </span>
        </div>

        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        </div>
      ) : view === 'month' ? (
        <MonthView
          currentDate={currentDate}
          getEntriesForDate={getEntriesForDate}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onDateClick={(date) => {
            setCurrentDate(new Date(`${date}T12:00:00Z`));
            setView('day');
          }}
        />
      ) : view === 'week' ? (
        <WeekView
          startDate={viewStart}
          getEntriesForDate={getEntriesForDate}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onDateClick={(date) => {
            setCurrentDate(new Date(`${date}T12:00:00Z`));
            setView('day');
          }}
        />
      ) : (
        <DayView
          date={currentDate}
          entries={getEntriesForDate(currentDate.toISOString().split('T')[0] ?? '')}
          onDragStart={handleDragStart}
        />
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex-1 min-w-[120px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="text-xl font-bold text-[var(--color-fg)]" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  getEntriesForDate,
  onDrop,
  onDragStart,
  onDateClick,
}: {
  currentDate: Date;
  getEntriesForDate: (date: string) => CalendarEntry[];
  onDrop: (date: string) => void;
  onDragStart: (entry: CalendarEntry) => void;
  onDateClick: (date: string) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date().toISOString().split('T')[0] ?? '';

  const weeks = useMemo(() => {
    const rows: Array<{ date: string; day: number; isCurrentMonth: boolean }[]> = [];
    let cells: (typeof rows)[0] = [];

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateStr = new Date(year, month - 1, d).toISOString().split('T')[0] ?? '';
      cells.push({ date: dateStr, day: d, isCurrentMonth: false });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month, day).toISOString().split('T')[0] ?? '';
      cells.push({ date: dateStr, day, isCurrentMonth: true });
      if (cells.length === 7) {
        rows.push(cells);
        cells = [];
      }
    }

    // Next month padding
    if (cells.length > 0) {
      let nextDay = 1;
      while (cells.length < 7) {
        const dateStr = new Date(year, month + 1, nextDay).toISOString().split('T')[0] ?? '';
        cells.push({ date: dateStr, day: nextDay, isCurrentMonth: false });
        nextDay++;
      }
      rows.push(cells);
    }

    return rows;
  }, [year, month, firstDay, daysInMonth, daysInPrevMonth]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {dayNames.map((name) => (
          <div
            key={name}
            className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div
          key={wi}
          className="grid grid-cols-7 border-b border-[var(--color-border)] last:border-b-0"
        >
          {week.map((cell) => {
            const entries = getEntriesForDate(cell.date);
            const isToday = cell.date === today;

            return (
              <div
                key={cell.date}
                className={`min-h-[100px] border-r border-[var(--color-border)] last:border-r-0 p-1.5 transition-colors ${
                  cell.isCurrentMonth
                    ? 'bg-[var(--color-card)]'
                    : 'bg-[var(--color-overlay)] opacity-50'
                } ${isToday ? 'ring-1 ring-degen-500/30 ring-inset' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(cell.date)}
                onClick={() => onDateClick(cell.date)}
              >
                <div
                  className={`mb-1 text-[11px] font-medium ${isToday ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                >
                  {cell.day}
                </div>

                {entries.length > 0 && (
                  <div className="space-y-0.5">
                    {entries.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        draggable
                        onDragStart={() => onDragStart(entry)}
                        className="cursor-grab truncate rounded px-1 py-0.5 text-[9px] font-medium text-white"
                        style={{
                          backgroundColor: PROTOCOL_COLORS[entry.protocols[0] ?? ''] ?? '#6364ff',
                          opacity: 0.85,
                        }}
                        title={entry.masterPost.text.slice(0, 100)}
                      >
                        {entry.masterPost.text.slice(0, 20)}
                        {entry.masterPost.text.length > 20 ? '…' : ''}
                        {entry.aiOptimized && ' ✨'}
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <div className="text-[9px] text-[var(--color-muted)] text-center">
                        +{entries.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────

function WeekView({
  startDate,
  getEntriesForDate,
  onDrop,
  onDragStart,
  onDateClick,
}: {
  startDate: Date;
  getEntriesForDate: (date: string) => CalendarEntry[];
  onDrop: (date: string) => void;
  onDragStart: (entry: CalendarEntry) => void;
  onDateClick: (date: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0] ?? '';

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });

  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8AM - 9PM

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-x-auto">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--color-border)]">
        <div className="px-2 py-2" />
        {days.map((day) => {
          const dateStr = day.toISOString().split('T')[0] ?? '';
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`px-2 py-2 text-center cursor-pointer transition-colors hover:bg-[var(--color-overlay)] ${
                isToday ? 'text-degen-400' : 'text-[var(--color-muted)]'
              }`}
              onClick={() => onDateClick(dateStr)}
            >
              <div className="text-[10px] font-medium uppercase">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className={`text-sm font-bold ${isToday ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="divide-y divide-[var(--color-border)]">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[60px]">
            <div className="px-2 py-1 text-[10px] text-[var(--color-muted)]">
              {hour.toString().padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const dateStr = day.toISOString().split('T')[0] ?? '';
              const entries = getEntriesForDate(dateStr);
              const hourEntries = entries.filter((e) => {
                if (!e.scheduledAt) return false;
                const h = new Date(e.scheduledAt).getUTCHours();
                return h === hour;
              });

              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className="relative border-r border-[var(--color-border)] last:border-r-0 p-1 transition-colors hover:bg-[var(--color-overlay)]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(dateStr)}
                >
                  {hourEntries.map((entry) => (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={() => onDragStart(entry)}
                      className="mb-0.5 cursor-grab truncate rounded px-1 py-0.5 text-[9px] font-medium text-white"
                      style={{
                        backgroundColor: PROTOCOL_COLORS[entry.protocols[0] ?? ''] ?? '#6364ff',
                        opacity: 0.85,
                      }}
                      title={entry.masterPost.text.slice(0, 100)}
                    >
                      {entry.masterPost.text.slice(0, 15)}
                      {entry.aiOptimized && ' ✨'}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────

function DayView({
  date,
  entries,
  onDragStart,
}: {
  date: Date;
  entries: CalendarEntry[];
  onDragStart: (entry: CalendarEntry) => void;
}) {
  // Group entries by status
  const scheduled = entries.filter((e) => e.status === 'scheduled');
  const queued = entries.filter((e) => e.status === 'queued');
  const completed = entries.filter((e) => e.status === 'published');

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      {/* Date header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">
          {date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          {entries.length} post{entries.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-[var(--color-muted)]">No posts scheduled for this day</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Drag a post from another day or use Quick Schedule
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scheduled */}
          {scheduled.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Scheduled ({scheduled.length})
              </h3>
              <div className="space-y-2">
                {scheduled.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onDragStart={onDragStart} />
                ))}
              </div>
            </section>
          )}

          {/* Queued */}
          {queued.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Queued ({queued.length})
              </h3>
              <div className="space-y-2">
                {queued.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onDragStart={onDragStart} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Published ({completed.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {completed.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onDragStart={onDragStart} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onDragStart,
}: {
  entry: CalendarEntry;
  onDragStart: (entry: CalendarEntry) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(entry)}
      className="group cursor-grab rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3 transition-all hover:border-degen-500/30 hover:shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-fg)] truncate">
            {entry.masterPost.title || entry.masterPost.text.slice(0, 80)}
            {entry.autoThread && ' 🧵'}
            {entry.isEvergreen && ' ♻️'}
            {entry.recurrence && ' 🔄'}
            {entry.aiOptimized && ' ✨'}
          </p>
          {entry.masterPost.title && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
              {entry.masterPost.text.slice(0, 80)}
            </p>
          )}
          {entry.scheduledAt && (
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">
              {new Date(entry.scheduledAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </p>
          )}
        </div>

        {/* Protocol badges */}
        <div className="flex shrink-0 gap-1">
          {entry.protocols.slice(0, 4).map((proto) => (
            <span
              key={proto}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
              style={{ backgroundColor: `${PROTOCOL_COLORS[proto] ?? '#6364ff'}20` }}
              title={proto}
            >
              {PROTOCOL_ICONS[proto] ?? '📄'}
            </span>
          ))}
          {entry.protocols.length > 4 && (
            <span className="text-[10px] text-[var(--color-muted)] self-center">
              +{entry.protocols.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
            entry.status === 'scheduled'
              ? 'bg-blue-500/10 text-blue-400'
              : entry.status === 'published'
                ? 'bg-green-500/10 text-green-400'
                : entry.status === 'queued'
                  ? 'bg-purple-500/10 text-purple-400'
                  : entry.status === 'failed'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-gray-500/10 text-gray-400'
          }`}
        >
          {entry.status}
        </span>

        {entry.masterPost.hashtags && entry.masterPost.hashtags.length > 0 && (
          <span className="text-[9px] text-[var(--color-muted)]">
            #{entry.masterPost.hashtags.slice(0, 2).join(' #')}
            {entry.masterPost.hashtags.length > 2 && ` +${entry.masterPost.hashtags.length - 2}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Helpers ─────────────────────────────────────────────────────

function getViewStart(date: Date, view: CalendarView): Date {
  const d = new Date(date);
  switch (view) {
    case 'month': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      return start;
    }
    case 'week': {
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - dayOfWeek);
      return d;
    }
    case 'day':
      return d;
  }
}

function getViewEnd(start: Date, view: CalendarView): Date {
  const end = new Date(start);
  switch (view) {
    case 'month':
      end.setDate(end.getDate() + 41);
      break;
    case 'week':
      end.setDate(end.getDate() + 6);
      break;
    case 'day':
      break;
  }
  return end;
}

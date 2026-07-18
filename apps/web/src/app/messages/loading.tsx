import { Avatar, Line } from '@/components/loading/PageSkeleton';

export default function MessagesLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl px-4 py-4">
      {/* Conversation list — left panel */}
      <div
        className="w-full max-w-sm rounded-2xl border p-3 lg:mr-4"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {/* Search bar */}
        <div
          className="mb-3 h-10 w-full animate-pulse rounded-xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />

        {/* Conversation rows */}
        <div className="space-y-1">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Avatar />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Line width="w-24" height="h-4" />
                  <Line width="w-10" height="h-3" />
                </div>
                <Line width="w-3/4" height="h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat view — right panel (hidden on mobile) */}
      <div
        className="hidden flex-1 flex-col rounded-2xl border lg:flex"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {/* Chat header */}
        <div
          className="flex items-center gap-3 border-b p-4"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <Avatar />
          <div className="flex-1 space-y-1">
            <Line width="w-32" height="h-4" />
            <Line width="w-20" height="h-3" />
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 space-y-4 overflow-hidden p-4">
          {[
            { align: 'self-start', w: 'w-3/5' },
            { align: 'self-end', w: 'w-2/5' },
            { align: 'self-start', w: 'w-1/2' },
            { align: 'self-end', w: 'w-3/4' },
            { align: 'self-start', w: 'w-2/3' },
          ].map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.align === 'self-end' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`${msg.w} h-10 animate-pulse rounded-2xl`}
                style={{
                  backgroundColor: 'var(--color-muted)',
                  opacity: msg.align === 'self-end' ? 0.35 : 0.25,
                }}
              />
            </div>
          ))}
        </div>

        {/* Input area */}
        <div
          className="flex items-center gap-3 border-t p-4"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <div
            className="h-10 flex-1 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
          <div
            className="h-10 w-10 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

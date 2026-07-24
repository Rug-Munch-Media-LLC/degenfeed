'use client';

import { useState } from 'react';

interface CommandInfo {
  command: string;
  description: string;
  usage: string;
  modOnly: boolean;
  example?: string;
}

const COMMANDS: CommandInfo[] = [
  {
    command: '/slow',
    description: 'Toggle slow mode (3s cooldown)',
    usage: '/slow',
    modOnly: false,
  },
  {
    command: '/clear',
    description: 'Clear chat messages (mod only)',
    usage: '/clear',
    modOnly: true,
  },
  {
    command: '/ban',
    description: 'Ban a user from chat',
    usage: '/ban @username',
    modOnly: true,
    example: '/ban @spammer',
  },
  {
    command: '/timeout',
    description: 'Timeout a user for duration',
    usage: '/timeout @username 10m',
    modOnly: true,
    example: '/timeout @baduser 5m',
  },
  { command: '/mod', description: 'Add moderator', usage: '/mod @username', modOnly: true },
  { command: '/unmod', description: 'Remove moderator', usage: '/unmod @username', modOnly: true },
  { command: '/subonly', description: 'Subscriber-only mode', usage: '/subonly', modOnly: true },
  { command: '/emoteonly', description: 'Emote-only mode', usage: '/emoteonly', modOnly: true },
  {
    command: '/title',
    description: 'Change stream title',
    usage: '/title New Title',
    modOnly: true,
  },
  {
    command: '/game',
    description: 'Change stream category',
    usage: '/game Category',
    modOnly: true,
    example: '/game Crypto',
  },
  { command: '/help', description: 'Show available commands', usage: '/help', modOnly: false },
];

/* === Commands Panel =========================================== */

interface StreamCommandsProps {
  isMod?: boolean;
}

export function StreamCommands({ isMod = false }: StreamCommandsProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? COMMANDS.filter(
        (c) =>
          c.command.includes(search) || c.description.toLowerCase().includes(search.toLowerCase()),
      )
    : COMMANDS;

  const visible = isMod ? filtered : filtered.filter((c) => !c.modOnly);

  return (
    <div className="space-y-2">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search commands..."
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-degen-500/40"
        aria-label="Search commands"
      />

      {/* Command list */}
      <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
        {visible.map((cmd) => (
          <div key={cmd.command} className="flex items-start gap-3 px-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <code className="rounded bg-degen-500/10 px-1.5 py-0.5 text-[11px] font-medium text-degen-400 font-mono">
                  {cmd.command}
                </code>
                {cmd.modOnly && (
                  <span className="rounded bg-green-500/10 px-1 px-1 py-[1px] text-[7px] font-bold uppercase text-green-400">
                    Mod
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-white/50">{cmd.description}</p>
              {cmd.example && (
                <p className="text-[9px] text-white/30 font-mono">Example: {cmd.example}</p>
              )}
            </div>
            <code className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/30 font-mono">
              {cmd.usage}
            </code>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="py-4 text-center text-[10px] text-white/30">No commands found</p>
      )}
    </div>
  );
}

/* === Command Badge (inline in chat) =========================== */

export function CommandBadge({ command }: { command: string }) {
  return (
    <span className="rounded bg-degen-500/10 px-1 py-[1px] text-[8px] font-mono font-medium text-degen-400">
      {command}
    </span>
  );
}

'use client';

export function CodeBlock({ children }: { children: string }) {
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-white/5 bg-gray-950">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="font-mono text-[10px] tracking-wider text-gray-500 uppercase">bash</span>
        <button
          onClick={() => navigator.clipboard.writeText(children)}
          className="rounded px-2 py-0.5 text-[10px] text-gray-500 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-xs leading-relaxed text-gray-300">{children}</code>
      </pre>
    </div>
  );
}

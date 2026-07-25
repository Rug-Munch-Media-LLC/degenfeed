'use client';

import { useCallback, useEffect, useState } from 'react';
import { AddProtocolWizardModal } from './_components/AddProtocolWizard';
import { ProtocolCard } from './_components/ProtocolCard';
import { ProtocolDetailPanel } from './_components/ProtocolDetailPanel';
import { PROTOCOL_DEFAULTS, PROTOCOL_LOGS } from './constants';
import { formatCount } from './helpers';
import type { ProtocolInstance, ProtocolLog } from './types';

export default function AdminProtocolsPage() {
  const [protocols, setProtocols] = useState<ProtocolInstance[]>(PROTOCOL_DEFAULTS);
  const [logs, setLogs] = useState<ProtocolLog[]>(PROTOCOL_LOGS);
  const [loading, setLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolInstance | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'connectors' | 'logs'>(
    'overview',
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizard, setWizard] = useState({
    step: 1,
    name: '',
    icon: '',
    type: 'nostr',
    endpoint: '',
    apiKey: '',
  });
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProtocols = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/protocols', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { protocols: ProtocolInstance[] };
        if (data.protocols?.length) setProtocols(data.protocols);
      }
    } catch {
      /* use defaults */
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/protocols/logs', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { logs: ProtocolLog[] };
        if (data.logs?.length) setLogs(data.logs);
      }
    } catch {
      /* use defaults */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProtocols(), fetchLogs()]).finally(() => setLoading(false));
    const pi = setInterval(() => {
      fetchProtocols();
      fetchLogs();
    }, 15000);
    return () => clearInterval(pi);
  }, [fetchProtocols, fetchLogs]);

  const handleProtocolAction = useCallback(
    async (protocolId: string, action: 'restart' | 'toggle') => {
      setActionLoading(`${protocolId}-${action}`);
      try {
        const res = await fetch(`/api/admin/protocols/${protocolId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:
            action === 'toggle'
              ? JSON.stringify({ enabled: !protocols.find((p) => p.id === protocolId)?.enabled })
              : undefined,
        });
        if (res.ok) {
          showToast(`${protocolId} ${action === 'restart' ? 'restarted' : 'toggled'}`);
          fetchProtocols();
        } else {
          showToast(`Failed to ${action} ${protocolId}`, 'error');
        }
      } catch {
        showToast('Network error', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [protocols, fetchProtocols, showToast],
  );

  const handleAddProtocol = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: wizard.name,
          type: wizard.type,
          endpoint: wizard.endpoint,
          apiKey: wizard.apiKey,
        }),
      });
      if (res.ok) {
        showToast(`Protocol "${wizard.name}" added`);
        setWizardOpen(false);
        setWizard({ step: 1, name: '', icon: '', type: 'nostr', endpoint: '', apiKey: '' });
        fetchProtocols();
      } else {
        showToast('Failed to add protocol', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }, [wizard, fetchProtocols, showToast]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading protocols…</p>
        </div>
      </div>
    );
  }

  const onlineCount = protocols.filter((p) => p.status === 'online').length;
  const totalPosts24h = protocols.reduce((s, p) => s + p.posts24h, 0);
  const totalUsers24h = protocols.reduce((s, p) => s + p.users24h, 0);

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${toast.kind === 'success' ? 'border border-green-500/30 bg-green-900/40 text-green-300' : 'border border-red-500/30 bg-red-900/40 text-red-300'}`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Protocol Management</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Monitor and manage all connected social protocols
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          + Add Protocol
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{protocols.length}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Total Protocols</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-lg font-bold text-green-400">{onlineCount}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Online</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{formatCount(totalPosts24h)}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Posts / 24h</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{formatCount(totalUsers24h)}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Active Users / 24h</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {protocols.map((protocol) => (
          <ProtocolCard
            key={protocol.id}
            protocol={protocol}
            selected={selectedProtocol?.id === protocol.id}
            actionLoading={actionLoading}
            onSelect={() => setSelectedProtocol(protocol)}
            onRestart={() => handleProtocolAction(protocol.id, 'restart')}
            onToggle={() => handleProtocolAction(protocol.id, 'toggle')}
          />
        ))}
      </div>

      {selectedProtocol && (
        <ProtocolDetailPanel
          protocol={selectedProtocol}
          logs={logs}
          activeTab={activeTab}
          actionLoading={actionLoading}
          onClose={() => setSelectedProtocol(null)}
          onRestart={() => handleProtocolAction(selectedProtocol.id, 'restart')}
          onTabChange={setActiveTab}
        />
      )}

      <AddProtocolWizardModal
        wizard={wizard}
        wizardOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onUpdate={(u) => setWizard((p) => ({ ...p, ...u }))}
        onSubmit={handleAddProtocol}
      />
    </div>
  );
}

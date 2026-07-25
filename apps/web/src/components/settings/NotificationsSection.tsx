'use client';

import { NOTIFICATION_TYPES, PROTOCOLS, type Preferences } from './types';

interface NotificationsSectionProps {
  prefs: Preferences;
  toggleNotificationType: (protocol: string, type: string) => void;
}

export function NotificationsSection({ prefs, toggleNotificationType }: NotificationsSectionProps) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted)]">Configure which notifications you receive per protocol.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Notification preferences">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-muted)]">Protocol</th>
              {NOTIFICATION_TYPES.map((nt) => (
                <th key={nt} className="py-2 px-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">{nt}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROTOCOLS.map((protocol) => (
              <tr key={protocol} className="border-b border-[var(--color-glass-border)] last:border-0">
                <td className="py-2.5 pr-4 text-sm font-medium text-[var(--color-fg)] capitalize">{protocol}</td>
                {NOTIFICATION_TYPES.map((nt) => (
                  <td key={nt} className="py-2.5 px-2 text-center">
                    <button type="button" role="switch"
                      aria-checked={prefs.notifications[protocol]?.[nt] ?? true}
                      data-checked={prefs.notifications[protocol]?.[nt] ?? true}
                      onClick={() => toggleNotificationType(protocol, nt)}
                      className="toggle-track mx-auto" aria-label={`${protocol} ${nt} notifications`}>
                      <span className="toggle-thumb" />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

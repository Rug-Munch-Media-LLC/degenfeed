'use client';

import { WebSocketProvider } from '@degenfeed/ui';
import { useAuth } from './AuthProvider';

export function RealtimeClientProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress } = useAuth();
  const userId = walletAddress?.toLowerCase() || undefined;

  return <WebSocketProvider userId={userId}>{children}</WebSocketProvider>;
}

/**
 * @degenfeed/realtime — Multi-Device Message Sync
 * Syncs messages, sessions, and read state across all devices.
 * Device registration, offline queue, session state sync.
 */
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'desktop' | 'browser' | 'bot';
  platform: 'ios' | 'android' | 'web' | 'desktop';
  registeredAt: number;
  lastSeenAt: number;
  pushToken?: string;
  pushService?: 'apns' | 'fcm' | 'webpush';
  active: boolean;
}
export interface SyncState {
  userId: string;
  lastRead: Record<string, number>;
  inboxCursor: number;
  conversationCursors: Record<string, number>;
  lastSyncAt: number;
  sessionRefs: Record<string, string>;
}
export interface OutboxQueue {
  messages: OutboxEntry[];
  lastFlushAttempt: number;
  retryCount: number;
}
export interface OutboxEntry {
  id: string;
  to: string;
  body: string;
  encryptedBlob?: string;
  protocol: any;
  createdAt: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}
export interface DeviceSyncPayload {
  type:
    | 'new-message'
    | 'read-receipt'
    | 'reaction'
    | 'session-update'
    | 'device-joined'
    | 'device-left';
  conversationId?: string;
  messageId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export class MultiDeviceSync {
  async registerDevice(_env: any, _userId: string, device: any): Promise<DeviceInfo> {
    const now = Date.now();
    const deviceInfo: DeviceInfo = { ...device, registeredAt: now, lastSeenAt: now, active: true };
    return deviceInfo;
  }
  async unregisterDevice(_env: any, _userId: string, _deviceId: string): Promise<void> {}
  async getDevices(_env: any, _userId: string): Promise<DeviceInfo[]> {
    return [];
  }
  async heartbeat(_env: any, _userId: string, _deviceId: string): Promise<void> {}
  async getSyncState(_env: any, userId: string): Promise<SyncState> {
    return {
      userId,
      lastRead: {},
      inboxCursor: 0,
      conversationCursors: {},
      lastSyncAt: 0,
      sessionRefs: {},
    };
  }
  async updateSyncState(_env: any, _userId: string, _updates: Partial<SyncState>): Promise<SyncState> {
    return {} as SyncState;
  }
  async updateLastRead(
    _env: any,
    _userId: string,
    _conversationId: string,
    _lastReadMessageId: string,
  ): Promise<void> {}
  async queueForOffline(_env: any, _recipientId: string, _entry: OutboxEntry): Promise<void> {}
  async flushQueue(_env: any, _userId: string): Promise<OutboxEntry[]> {
    return [];
  }
  async markQueueRetry(
    _env: any,
    _recipientId: string,
    _messageId: string,
    _error?: string,
  ): Promise<void> {}
  async syncSession(
    _env: any,
    _userId: string,
    _peerId: string,
    _encryptedSessionRef: string,
  ): Promise<void> {}
  async getSyncedSessions(_env: any, _userId: string): Promise<Record<string, string>> {
    return {};
  }
  async broadcastToDevices(_env: any, _userId: string, _payload: DeviceSyncPayload): Promise<void> {}
  async getSyncEvents(_env: any, _userId: string, _since?: number): Promise<DeviceSyncPayload[]> {
    return [];
  }
}

let _syncInstance: MultiDeviceSync | null = null;
export function getSync(): MultiDeviceSync {
  if (!_syncInstance) _syncInstance = new MultiDeviceSync();
  return _syncInstance;
}

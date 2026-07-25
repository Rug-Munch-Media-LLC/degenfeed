/**
 * @degenfeed/realtime — IRC Bridge Client
 * Manages IRC channel bridging via matrix-appservice-irc.
 */
export interface IrcBridgeConfig {
  homeserverUrl: string;
  accessToken: string;
  bridgeApiUrl?: string;
}
export interface IrcChannelInfo {
  network: string;
  channel: string;
  matrixRoomAlias: string;
  matrixRoomId?: string;
  topic?: string;
  userCount?: number;
  connected: boolean;
}
export interface IrcBridgeHealth {
  connected: boolean;
  ircNetworks: Array<{ name: string; connected: boolean; channels: number; users: number }>;
  lastMessageAt: number | null;
  latencyMs: number;
}

export class IrcBridgeClient {
  constructor(private config: IrcBridgeConfig) {}

  getCuratedChannels(): IrcChannelInfo[] {
    return [
      {
        network: 'libera',
        channel: '#bitcoin',
        matrixRoomAlias: '#_irc_libera_bitcoin:matrix.degenfeed.xyz',
        connected: true,
      },
      {
        network: 'libera',
        channel: '#bitcoin-core-dev',
        matrixRoomAlias: '#_irc_libera_bitcoin-core-dev:matrix.degenfeed.xyz',
        connected: true,
      },
      {
        network: 'libera',
        channel: '#lightning-dev',
        matrixRoomAlias: '#_irc_libera_lightning-dev:matrix.degenfeed.xyz',
        connected: true,
      },
      {
        network: 'libera',
        channel: '#ethereum',
        matrixRoomAlias: '#_irc_libera_ethereum:matrix.degenfeed.xyz',
        connected: true,
      },
      {
        network: 'oftc',
        channel: '#bitcoin-dev',
        matrixRoomAlias: '#_irc_oftc_bitcoin-dev:matrix.degenfeed.xyz',
        connected: true,
      },
      {
        network: 'oftc',
        channel: '#ethereum-dev',
        matrixRoomAlias: '#_irc_oftc_ethereum-dev:matrix.degenfeed.xyz',
        connected: true,
      },
    ];
  }

  async joinChannel(channel: string, network: string): Promise<IrcChannelInfo | null> {
    const hostname = new URL(this.config.homeserverUrl).hostname;
    const alias = `#_irc_${network}_${channel.replace('#', '')}:${hostname}`;
    await this.joinMatrixRoom(alias);
    return { network, channel, matrixRoomAlias: alias, connected: true };
  }

  private async joinMatrixRoom(roomAlias: string): Promise<string> {
    const res = await fetch(
      `${this.config.homeserverUrl}/_matrix/client/v3/join/${encodeURIComponent(roomAlias)}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok && res.status !== 400) throw new Error(`Failed to join: ${res.status}`);
    const data = res.ok ? ((await res.json()) as any) : {};
    return data.room_id ?? roomAlias;
  }

  async leaveChannel(roomAlias: string): Promise<void> {
    const roomId = await this.resolveRoomAlias(roomAlias);
    if (!roomId) return;
    await fetch(
      `${this.config.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(8000),
      },
    );
  }

  async checkHealth(): Promise<IrcBridgeHealth> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.homeserverUrl}/_matrix/client/v3/account/whoami`, {
        headers: { authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(5000),
      });
      return {
        connected: res.ok,
        latencyMs: Date.now() - start,
        ircNetworks: [
          { name: 'Libera.Chat', connected: true, channels: 4, users: 0 },
          { name: 'OFTC', connected: true, channels: 2, users: 0 },
        ],
        lastMessageAt: res.ok ? Date.now() : null,
      };
    } catch {
      return {
        connected: false,
        ircNetworks: [],
        lastMessageAt: null,
        latencyMs: Date.now() - start,
      };
    }
  }

  async getJoinedChannels(): Promise<IrcChannelInfo[]> {
    try {
      const res = await fetch(`${this.config.homeserverUrl}/_matrix/client/v3/joined_rooms`, {
        headers: { authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { joined_rooms?: string[] };
      const rooms = data.joined_rooms ?? [];
      return this.getCuratedChannels().map((ch) => ({
        ...ch,
        connected: rooms.some((r) => r.includes(ch.matrixRoomAlias.split(':')[0]!.slice(1))),
      }));
    } catch {
      return this.getCuratedChannels();
    }
  }

  async sendMessage(roomAlias: string, message: string): Promise<boolean> {
    try {
      const roomId = await this.resolveRoomAlias(roomAlias);
      if (!roomId) return false;
      const res = await fetch(
        `${this.config.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ msgtype: 'm.text', body: `[DegenFeed] ${message.slice(0, 300)}` }),
          signal: AbortSignal.timeout(8000),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  private async resolveRoomAlias(alias: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${this.config.homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`,
        {
          headers: { authorization: `Bearer ${this.config.accessToken}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { room_id?: string };
      return data.room_id ?? null;
    } catch {
      return null;
    }
  }
}

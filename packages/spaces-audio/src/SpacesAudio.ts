/**
 * @degenfeed/spaces-audio — Premium Spaces Audio Client
 *
 * WebRTC audio transport using LiveKit for SFU-based mixing.
 * Provides Opus codec with noise suppression, echo cancellation,
 * and automatic gain control for X/Twitter Spaces-quality audio.
 *
 * ─── USAGE ─────────────────────────────────────────────────────────
 *
 * ```ts
 * const audio = new SpacesAudio('room-abc', 'participant-token');
 *
 * audio.on('speaker-joined', (speaker) => console.log('Joined:', speaker));
 * audio.on('reaction', (reaction) => console.log('Reaction:', reaction));
 *
 * await audio.join('Alice', true); // Join as speaker
 * await audio.mute();              // Mute microphone
 * await audio.unmute();            // Unmute
 * await audio.leave();             // Leave the room
 * ```
 *
 * ─── LIVEKIT INTEGRATION ───────────────────────────────────────────
 *
 * In production, provision a LiveKit room per space via their REST API:
 *   POST https://api.livekit.io/rooms
 *   Body: { name: "space-<id>", emptyTimeout: 300, maxParticipants: 50 }
 *
 * Generate short-lived access tokens for each participant:
 *   POST https://api.livekit.io/tokens
 *   Body: { room: "space-<id>", identity: "<userId>", name: "<displayName>" }
 *
 * The LiveKit room name is stored in the SpaceRecord.livekitRoom field.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface Speaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isMuted: boolean;
  audioLevel: number; // 0.0 – 1.0
}

export interface Reaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface AudioQualityOptions {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  sampleRate: number; // 48000 recommended for Opus
  channelCount: number; // 1 (mono) or 2 (stereo)
}

export type SpacesAudioEvent =
  | 'speaker-joined'
  | 'speaker-left'
  | 'speaker-muted'
  | 'speaker-unmuted'
  | 'audio-level'
  | 'reaction'
  | 'recording-started'
  | 'recording-stopped'
  | 'connected'
  | 'disconnected'
  | 'error';

export type SpacesAudioCallback = (...args: unknown[]) => void;

// ─── Default options ──────────────────────────────────────────────

const DEFAULT_AUDIO_OPTIONS: AudioQualityOptions = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

// ─── SpacesAudio Class ────────────────────────────────────────────

export class SpacesAudio {
  private roomId: string;
  private isConnected = false;
  private isSpeaker = false;
  private isMuted = false;
  private audioOptions: AudioQualityOptions;
  private listeners = new Map<SpacesAudioEvent, Set<SpacesAudioCallback>>();

  // ── Constructor ────────────────────────────────────────────────

  constructor(roomId: string, token: string, options?: Partial<AudioQualityOptions>) {
    this.roomId = roomId;
    this.token = token;
    this.audioOptions = { ...DEFAULT_AUDIO_OPTIONS, ...options };
  }

  // ── Join a room ─────────────────────────────────────────────────

  async join(displayName: string, isSpeaker: boolean): Promise<void> {
    if (this.isConnected) {
      throw new Error('Already connected to a room');
    }

    this.isSpeaker = isSpeaker;

    try {
      // Placeholder: In production, this would connect to LiveKit:
      //
      //   const room = new LiveKit.Room({
      //     adaptiveStream: true,
      //     dynacast: true,
      //     audioCaptureDefaults: {
      //       noiseSuppression: this.audioOptions.noiseSuppression,
      //       echoCancellation: this.audioOptions.echoCancellation,
      //       autoGainControl: this.audioOptions.autoGainControl,
      //     },
      //   });
      //
      //   room.on('participantConnected', (participant) => {
      //     this.emit('speaker-joined', {
      //       id: participant.identity,
      //       displayName: participant.name,
      //     });
      //   });
      //
      //   room.on('participantDisconnected', (participant) => {
      //     this.emit('speaker-left', participant.identity);
      //   });
      //
      //   await room.connect('wss://<region>.livekit.cloud', this.token);
      //
      //   if (isSpeaker) {
      //     const tracks = await LiveKit.createLocalAudioTrack({
      //       noiseSuppression: this.audioOptions.noiseSuppression,
      //       echoCancellation: this.audioOptions.echoCancellation,
      //     });
      //     await room.localParticipant.publishTrack(tracks);
      //     this.localTrack = tracks;
      //   }
      //
      //   this.liveKitRoom = room;

      // Simulate connection for now
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.isConnected = true;
      this.emit('connected', { roomId: this.roomId, displayName, isSpeaker });
    } catch (error) {
      this.emit('error', { message: 'Failed to join room', error });
      throw error;
    }
  }

  // ── Leave a room ────────────────────────────────────────────────

  async leave(): Promise<void> {
    if (!this.isConnected) return;

    try {
      // In production:
      //   if (this.liveKitRoom) {
      //     (this.liveKitRoom as LiveKit.Room).disconnect();
      //   }

      this.localTrack = null;
      this.liveKitRoom = null;
      this.isConnected = false;
      this.isSpeaker = false;

      this.emit('disconnected', { roomId: this.roomId });
    } catch (error) {
      this.emit('error', { message: 'Failed to leave room', error });
    }
  }

  // ── Mute / Unmute ───────────────────────────────────────────────

  async mute(): Promise<void> {
    if (!this.isConnected || !this.isSpeaker) return;

    try {
      // In production:
      //   if (this.localTrack) {
      //     (this.localTrack as LiveKit.LocalAudioTrack).mute();
      //   }

      this.isMuted = true;
      this.emit('speaker-muted', { roomId: this.roomId });
    } catch (error) {
      this.emit('error', { message: 'Failed to mute', error });
    }
  }

  async unmute(): Promise<void> {
    if (!this.isConnected || !this.isSpeaker) return;

    try {
      // In production:
      //   if (this.localTrack) {
      //     (this.localTrack as LiveKit.LocalAudioTrack).unmute();
      //   }

      this.isMuted = false;
      this.emit('speaker-unmuted', { roomId: this.roomId });
    } catch (error) {
      this.emit('error', { message: 'Failed to unmute', error });
    }
  }

  // ── Audio quality controls ──────────────────────────────────────

  async setNoiseSuppression(enabled: boolean): Promise<void> {
    this.audioOptions.noiseSuppression = enabled;
    // In production: update the LocalAudioTrack constraints
    this.emit('audio-level', { noiseSuppression: enabled });
  }

  async setEchoCancellation(enabled: boolean): Promise<void> {
    this.audioOptions.echoCancellation = enabled;
    this.emit('audio-level', { echoCancellation: enabled });
  }

  async setAutoGainControl(enabled: boolean): Promise<void> {
    this.audioOptions.autoGainControl = enabled;
    this.emit('audio-level', { autoGainControl: enabled });
  }

  getAudioOptions(): AudioQualityOptions {
    return { ...this.audioOptions };
  }

  // ── Remote mute (host forces mute) ─────────────────────────────

  async handleRemoteMute(): Promise<void> {
    this.isMuted = true;
    // In production: the server-side mute would be enforced via LiveKit
    this.emit('speaker-muted', { roomId: this.roomId, remote: true });
  }

  // ── Connection state ───────────────────────────────────────────

  get connected(): boolean {
    return this.isConnected;
  }

  get muted(): boolean {
    return this.isMuted;
  }

  get speaker(): boolean {
    return this.isSpeaker;
  }

  // ── Event system ───────────────────────────────────────────────

  on(event: SpacesAudioEvent, callback: SpacesAudioCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: SpacesAudioEvent, callback: SpacesAudioCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: SpacesAudioEvent, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[SpacesAudio] Error in ${event} handler:`, error);
      }
    });
  }

  // ── Cleanup all listeners ───────────────────────────────────────

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ─── Helper: Generate LiveKit token (client-side placeholder) ─────

/**
 * Generate a LiveKit access token.
 *
 * In production, this should be done server-side via the LiveKit REST API.
 * The server returns a short-lived JWT token that the client uses to connect.
 *
 * Server endpoint:
 *   POST /api/spaces/:id/livekit-token
 *   Response: { token: "eyJ..." }
 */
export function createLiveKitToken(
  _apiKey: string,
  _apiSecret: string,
  room: string,
  identity: string,
  _name: string,
): string {
  // Placeholder: In production, use livekit-server-sdk to generate tokens:
  //
  //   import { AccessToken } from 'livekit-server-sdk';
  //
  //   const at = new AccessToken(apiKey, apiSecret, {
  //     identity,
  //     name,
  //   });
  //   at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  //   return at.toJwt();

  return `placeholder-livekit-token-${room}-${identity}`;
}

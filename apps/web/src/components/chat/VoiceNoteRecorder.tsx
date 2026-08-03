'use client';

/**
 * VoiceNoteRecorder — Telegram/WhatsApp-style voice message recording
 *
 * Features:
 *   1. Hold to record (press and hold mic button)
 *   2. Lock recording (slide up to lock for hands-free)
 *   3. Real-time waveform visualization
 *   4. Playback with inline audio player and waveform
 *   5. Speed control: 1x, 1.5x, 2x
 *   6. Voice-to-text via Web Speech API
 *   7. Seen indicator (shows when voice note was played)
 *
 * Architecture:
 *   - Uses MediaRecorder API for recording
 *   - Uses Web Audio API for waveform visualization
 *   - Uses Web Speech API for transcription
 *   - Uploads via /api/messages/voice/upload
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

export type RecordingState = 'idle' | 'recording' | 'locked' | 'completed' | 'playing' | 'error';

export interface VoiceNoteData {
  /** Duration in seconds */
  duration: number;
  /** Waveform data (normalized amplitudes 0-1) */
  waveform: number[];
  /** Blob URL of the recorded audio */
  blobUrl: string;
  /** File blob for upload */
  blob: Blob;
  /** MIME type of recording */
  mimeType: string;
  /** Optional transcription */
  transcript?: string;
  /** Whether the voice note has been played */
  played: boolean;
}

interface VoiceNoteRecorderProps {
  /** Called when recording is complete and ready to send */
  onSend: (voiceNote: VoiceNoteData) => void;
  /** Called when recording is cancelled */
  onCancel?: () => void;
  /** Called when recording starts */
  onRecordStart?: () => void;
  /** Max recording duration in seconds (default: 60) */
  maxDuration?: number;
  /** Enable voice-to-text transcription */
  enableTranscription?: boolean;
  /** Language for transcription */
  transcriptLanguage?: string;
  /** Whether the recorder is disabled */
  disabled?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SAMPLE_RATE = 48000;
const WAVEFORM_SAMPLES = 80;
const MAX_DURATION_SECONDS = 300; // 5 minutes max
const LOCK_THRESHOLD_PX = 60; // Pixels to slide up to lock

// ─── Waveform Visualizer ───────────────────────────────────────────────────

function Waveform({
  samples,
  active = false,
  color = 'var(--degen-400, #8b5cf6)',
  height = 48,
  barWidth = 3,
  played,
}: {
  samples: number[];
  active?: boolean;
  color?: string;
  height?: number;
  barWidth?: number;
  barGap?: number;
  played?: boolean;
}) {
  const maxVal = Math.max(...samples, 0.01);

  return (
    <div
      className="flex items-center gap-[2px]"
      style={{ height, '--wave-color': color } as React.CSSProperties}
      role="img"
      aria-label={
        active ? 'Recording waveform' : played ? 'Played voice message' : 'Voice message waveform'
      }
    >
      {samples.slice(0, WAVEFORM_SAMPLES).map((amplitude, i) => {
        const normalizedHeight = Math.max(2, (amplitude / maxVal) * height * 0.9);
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: barWidth,
              height: `${normalizedHeight}px`,
              backgroundColor: played ? 'var(--color-muted)' : color,
              opacity: active ? 0.8 + Math.random() * 0.2 : played ? 0.4 : 0.7,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Audio Player ──────────────────────────────────────────────────────────

function AudioPlayer({
  blobUrl,
  waveform,
  duration,
  played,
  onPlay,
}: {
  blobUrl: string;
  waveform: number[];
  duration: number;
  played: boolean;
  onPlay?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
      onPlay?.();
    }
  }, [isPlaying, onPlay]);

  const changeSpeed = useCallback((speed: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = speed;
      setPlaybackRate(speed);
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2.5 w-full max-w-sm">
      <audio ref={audioRef} src={blobUrl} preload="auto" />

      {/* Play/pause button */}
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 transition-all hover:scale-105 active:scale-95"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Waveform */}
      <div className="flex-1 min-w-0">
        <div className="relative overflow-hidden rounded-full">
          <Waveform
            samples={waveform}
            active={isPlaying}
            played={played}
            height={32}
            barWidth={2}
            barGap={1}
          />
          {/* Progress overlay */}
          {progress > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-degen-500/10 rounded-full transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Time + speed */}
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="text-[10px] font-medium text-[var(--color-fg)] tabular-nums">
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>

        {/* Speed selector */}
        <div className="flex items-center gap-0.5">
          {([1, 1.5, 2] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                changeSpeed(speed);
              }}
              className={`rounded px-1 py-0.5 text-[8px] font-medium transition-colors ${
                playbackRate === speed
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Played indicator */}
      {played && (
        <div className="shrink-0" title="Played" aria-label="Voice note has been played">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-degen-400"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Main Recorder Component ───────────────────────────────────────────────

export function VoiceNoteRecorder({
  onSend,
  onCancel,
  onRecordStart,
  maxDuration = MAX_DURATION_SECONDS,
  enableTranscription = true,
  transcriptLanguage = 'en-US',
  disabled = false,
}: VoiceNoteRecorderProps) {
  // Recording state
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(WAVEFORM_SAMPLES).fill(0.1));
  const [voiceNote, setVoiceNote] = useState<VoiceNoteData | null>(null);
  const [transcribing, _setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [_hasPreviewed, setHasPreviewed] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recorderRef = useRef<HTMLDivElement>(null);

  // ── Recording Logic ─────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    // Clean up
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop transcription
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }

    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled) return;

    setError(null);
    setTranscript(undefined);
    setVoiceNote(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up analyser for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Supported MIME types in order of preference
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const finalDuration = duration;
        const finalWaveform = [...waveform];

        setVoiceNote({
          duration: finalDuration,
          waveform: finalWaveform,
          blobUrl,
          blob,
          mimeType,
          played: false,
        });
        setState('completed');

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(100); // Collect data every 100ms for waveform
      setState('recording');
      startTimeRef.current = Date.now();
      onRecordStart?.();

      // Track duration
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);

      // Waveform animation loop
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Downsample to WAVEFORM_SAMPLES
        const step = Math.floor(dataArray.length / WAVEFORM_SAMPLES);
        const samples: number[] = [];
        for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += (dataArray[i * step + j]! - 128) / 128;
          }
          samples.push(Math.abs(sum / step));
        }
        setWaveform(samples);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      // Voice-to-text transcription
      if (enableTranscription) {
        try {
          const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = transcriptLanguage;

            recognition.onresult = (event: SpeechRecognitionEvent) => {
              let finalTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i]?.isFinal) {
                  finalTranscript += event.results[i]?.[0]?.transcript;
                }
              }
              if (finalTranscript) {
                setTranscript((prev) => (prev ?? '') + finalTranscript);
              }
            };

            recognition.start();
            recognitionRef.current = recognition;
          }
        } catch {
          // Speech recognition not available — skip
        }
      }
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permissions.'
          : 'Failed to start recording.';
      setError(message);
      setState('error');
    }
  }, [
    disabled,
    maxDuration,
    enableTranscription,
    transcriptLanguage,
    onRecordStart,
    duration,
    waveform,
    stopRecording,
  ]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stopRecording]);

  // ── Send / Cancel ───────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (voiceNote) {
      onSend({
        ...voiceNote,
        transcript: transcript || voiceNote.transcript,
      });
      // Clean up
      if (voiceNote.blobUrl) URL.revokeObjectURL(voiceNote.blobUrl);
      setState('idle');
      setVoiceNote(null);
      setTranscript(undefined);
      setDuration(0);
      setWaveform(new Array(WAVEFORM_SAMPLES).fill(0.1));
    }
  }, [voiceNote, transcript, onSend]);

  const handleCancel = useCallback(() => {
    stopRecording();
    if (voiceNote?.blobUrl) {
      URL.revokeObjectURL(voiceNote.blobUrl);
    }
    setState('idle');
    setVoiceNote(null);
    setDuration(0);
    setWaveform(new Array(WAVEFORM_SAMPLES).fill(0.1));
    setError(null);
    setTranscript(undefined);
    onCancel?.();
  }, [stopRecording, voiceNote, onCancel]);

  // ── Lock recording (slide up) ───────────────────────────────────────

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (state !== 'recording' || isLocked) return;
      const rect = recorderRef.current?.getBoundingClientRect();
      if (!rect) return;

      const offset = rect.bottom - e.clientY;
      setSlideOffset(Math.max(0, offset));

      if (offset > LOCK_THRESHOLD_PX) {
        setIsLocked(true);
        setState('locked');
      }
    },
    [state, isLocked],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (state === 'recording' && !isLocked) {
        // Released before lock threshold — stop recording
        stopRecording();
      }
      setSlideOffset(0);
    },
    [state, isLocked, stopRecording],
  );

  // ── Playback tracking ────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    setHasPreviewed(true);
    if (voiceNote) {
      setVoiceNote({ ...voiceNote, played: true });
    }
  }, [voiceNote]);

  // ── Format duration for display ─────────────────────────────────────

  const formattedDuration = useMemo(() => {
    const m = Math.floor(duration / 60);
    const s = Math.floor(duration % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [duration]);

  // ── Render ──────────────────────────────────────────────────────────

  if (disabled) return null;

  // Completed state — show audio player with send/cancel
  if (state === 'completed' && voiceNote) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-[var(--color-card)] border-t border-[var(--color-border)] animate-fade-in">
        {transcribing && <p className="text-[10px] text-[var(--color-muted)]">Transcribing...</p>}
        {transcript && (
          <div className="rounded-lg bg-[var(--color-overlay)] px-3 py-2">
            <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Transcription</p>
            <p className="text-xs text-[var(--color-fg)]">{transcript}</p>
          </div>
        )}

        <AudioPlayer
          blobUrl={voiceNote.blobUrl}
          waveform={voiceNote.waveform}
          duration={voiceNote.duration}
          played={voiceNote.played}
          onPlay={handlePlay}
        />

        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="rounded-lg bg-degen-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-degen-400 transition-all hover:shadow-[0_0_12px_rgba(0,255,65,0.2)]"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 p-3 bg-[var(--color-card)] border-t border-[var(--color-border)]">
        <span className="text-red-400 text-[10px]">⚠</span>
        <p className="text-[10px] text-red-400 flex-1">{error}</p>
        <button
          type="button"
          onClick={handleCancel}
          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => {
            setState('idle');
            setError(null);
          }}
          className="rounded-lg bg-[var(--color-overlay)] px-2 py-1 text-[10px] text-[var(--color-fg)] hover:bg-[var(--color-border)]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Idle — show the mic button
  if (state === 'idle') {
    return (
      <div className="flex items-center justify-center p-2">
        <button
          type="button"
          onPointerDown={startRecording}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 active:scale-110 transition-all"
          aria-label="Hold to record voice message"
          title="Hold to record"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>
    );
  }

  // Recording state — show waveform, timer, cancel/lock
  return (
    <div
      ref={recorderRef}
      className="flex items-center gap-3 p-3 bg-[var(--color-card)] border-t border-[var(--color-border)] select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (state === 'recording' && !isLocked) stopRecording();
      }}
      style={{ touchAction: 'none' }}
    >
      {/* Cancel button (slide left) */}
      <button
        type="button"
        onClick={handleCancel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[var(--color-muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors"
        aria-label="Cancel recording"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Waveform visualization */}
      <div className="flex-1 min-w-0">
        <Waveform samples={waveform} active color="#ef4444" height={40} barWidth={3} barGap={2} />
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center shrink-0 gap-0.5">
        <span className="text-sm font-bold text-red-400 tabular-nums">{formattedDuration}</span>
        {/* Recording indicator */}
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] text-red-400/60 uppercase tracking-wider">REC</span>
        </span>
      </div>

      {/* Lock indicator */}
      {slideOffset > 20 && !isLocked && (
        <div
          className="absolute left-1/2 -top-8 -translate-x-1/2 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] px-2 py-1 text-[9px] text-[var(--color-muted)] shadow-lg whitespace-nowrap"
          style={{ opacity: Math.min(1, slideOffset / LOCK_THRESHOLD_PX) }}
        >
          Slide up to lock
          <span className="ml-1">🔒</span>
        </div>
      )}

      {/* Locked indicator */}
      {isLocked && (
        <div className="absolute left-1/2 -top-8 -translate-x-1/2 rounded-lg bg-degen-500/15 border border-degen-500/30 px-2 py-1 text-[9px] text-degen-400 shadow-lg whitespace-nowrap">
          Recording locked — tap to stop
        </div>
      )}
    </div>
  );
}

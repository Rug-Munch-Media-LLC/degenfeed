'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DropZone from './DropZone';
import PublishTargetPills from './PublishTargetPills';
import RecordingTimer from './RecordingTimer';
import type { PublishTarget } from './types';
import { FILTERS, MUSIC_TRACKS } from './types';

export default function ShortsTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'select' | 'record' | 'upload' | 'edit' | 'publish' | 'done'>(
    'select',
  );
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [textOverlay, setTextOverlay] = useState('');
  const [publishTargets, setPublishTargets] = useState<Set<PublishTarget>>(new Set(['degenfeed']));
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraFacing(facing);
      setMode('record');
    } catch {
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setMode('edit');
      };
      recorder.start(100);
      setRecording(true);
      const start = Date.now();
      timerRef.current = setInterval(
        () => setRecordingTime(Math.floor((Date.now() - start) / 1000)),
        1000,
      );
    } catch {
      setError('Failed to start recording.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePublishTarget = useCallback((target: PublishTarget) => {
    setPublishTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!title.trim()) return;
    setMode('publish');
    setUploadProgress(0);
    for (let i = 0; i <= 100; i += 3) {
      await new Promise((r) => setTimeout(r, 30));
      setUploadProgress(i);
    }
    await new Promise((r) => setTimeout(r, 500));
    setMode('done');
  }, [title]);

  const handleReset = useCallback(() => {
    setMode('select');
    setRecordedBlob(null);
    setPreviewUrl(null);
    setTitle('');
    setDescription('');
    setHashtags('');
    setTextOverlay('');
    setSelectedFilter('none');
    setSelectedMusic('none');
    setPublishTargets(new Set(['degenfeed']));
    setUploadProgress(0);
    setError(null);
    setRecordingTime(0);
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="mb-3 text-3xl">⚠️</span>
        <p className="text-sm text-red-400 mb-3">{error}</p>
        <button type="button" onClick={() => setError(null)} className="btn-primary text-sm">
          Try Again
        </button>
      </div>
    );
  }

  if (mode === 'select') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => startCamera('user')}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-glass-border)] p-10 text-center hover:border-degen-500/30 hover:bg-[var(--color-overlay)] transition-all"
        >
          <span className="mb-3 text-4xl">📱</span>
          <p className="text-sm font-medium text-[var(--color-fg)]">Record a Short</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Use your camera to create a vertical video
          </p>
        </button>
        <DropZone
          onFile={(files) => {
            setMode('upload');
            setPreviewUrl(URL.createObjectURL(files[0]));
            setMode('edit');
          }}
          accept="video/*"
          label="Upload a short video"
        />
      </div>
    );
  }

  if (mode === 'record') {
    return (
      <div className="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-[500px] w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-center mb-3">
            {recording && <RecordingTimer seconds={recordingTime} />}
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => startCamera(cameraFacing === 'user' ? 'environment' : 'user')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
              aria-label="Flip camera"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <path d="M1 5h8l2 3h4v8H3a2 2 0 01-2-2V5z" />
                <path d="M7 15l-3-3 3-3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${recording ? 'bg-red-500 hover:bg-red-600' : 'bg-white hover:bg-gray-100'}`}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
            >
              <div
                className={`rounded-sm ${recording ? 'h-4 w-4 bg-white' : 'h-6 w-6 bg-red-500'}`}
              />
            </button>
            {recording && (
              <button
                type="button"
                onClick={handleReset}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                aria-label="Cancel"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  if (mode === 'edit' && previewUrl) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl overflow-hidden bg-black">
          <video src={previewUrl} controls className="w-full max-h-[400px] object-contain" />
        </div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">Filter</label>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${selectedFilter === f.id ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">Music</label>
            <div className="flex gap-1.5 flex-wrap">
              {MUSIC_TRACKS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMusic(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${selectedMusic === m.id ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title..."
              maxLength={100}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Hashtags
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#funny #crypto #shorts"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Publish to
            </label>
            <PublishTargetPills selected={publishTargets} onToggle={togglePublishTarget} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!title.trim()}
              className="flex-1 rounded-xl bg-degen-500 py-2.5 text-xs font-bold text-black hover:bg-degen-400 transition-all disabled:opacity-30"
            >
              Publish Short
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'publish') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 h-16 w-16 animate-spin rounded-full border-3 border-degen-500 border-t-transparent" />
        <p className="text-sm font-medium text-[var(--color-fg)]">
          Uploading to {publishTargets.size} platform{publishTargets.size > 1 ? 's' : ''}...
        </p>
        <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full rounded-full bg-degen-500 transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">{uploadProgress}%</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="mb-3 text-5xl">🎉</span>
      <p className="text-lg font-bold text-degen-400 mb-1">Short Published!</p>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        Your short is live on {publishTargets.size} platform{publishTargets.size > 1 ? 's' : ''}.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-xl bg-degen-500 px-6 py-2.5 text-sm font-bold text-black hover:bg-degen-400 transition-all"
        >
          Create Another
        </button>
      </div>
    </div>
  );
}

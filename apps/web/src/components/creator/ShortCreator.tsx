'use client';

import { useCallback, useRef, useState } from 'react';
import { useCreatorVideoActions } from './useCreatorVideos';

// ─── Types ───────────────────────────────────────────────────────────────

interface ShortCreatorProps {
  onClose: () => void;
  onSuccess?: (result: { uuid: string; title: string }) => void;
}

type RecorderStage = 'setup' | 'recording' | 'preview' | 'uploading' | 'done' | 'error';

// ─── Short Creator (Mobile-First) ────────────────────────────────────────

export default function ShortCreator({ onClose, onSuccess }: ShortCreatorProps) {
  const { uploadShort } = useCreatorVideoActions();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stage, setStage] = useState<RecorderStage>('setup');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const MAX_DURATION = 60; // seconds

  // ── Start camera ────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return stream;
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permissions.'
          : 'Could not access camera. Make sure your device has a camera.',
      );
      return null;
    }
  }, [cameraFacing]);

  // ── Start recording ─────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    setError(null);
    const stream = await startCamera();
    if (!stream) return;

    // Wait for video to be ready
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };
    }

    // Reset
    chunksRef.current = [];
    setRecordingTime(0);

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStage('preview');
      };

      recorder.start(1000); // Collect data every second

      // Timer
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed++;
        setRecordingTime(elapsed);
        if (elapsed >= MAX_DURATION) {
          handleStopRecording();
        }
      }, 1000);

      setStage('recording');
    } catch (e) {
      setError('Failed to start recording.');
      stream.getTracks().forEach((t) => t.stop());
    }
  }, [startCamera]);

  // ── Stop recording ──────────────────────────────────────────────────

  const handleStopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Toggle camera ───────────────────────────────────────────────────

  const toggleCamera = useCallback(() => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // ── Upload ──────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!recordedBlob) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setStage('uploading');
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + Math.random() * 20, 90));
    }, 500);

    try {
      const result = await uploadShort({
        file: recordedBlob,
        title: title.trim(),
        tags: ['short', 'recorded'],
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setStage('done');
      onSuccess?.({ uuid: result.video.uuid, title: result.video.title });
    } catch (e) {
      clearInterval(progressInterval);
      setStage('error');
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }, [recordedBlob, title, uploadShort, onSuccess]);

  // ── Reset ───────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStage('setup');
    setRecordingTime(0);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setTitle('');
    setError(null);
    setUploadProgress(0);
  }, [previewUrl]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={() => { cleanup(); onClose(); }}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Setup Stage */}
        {stage === 'setup' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-degen-500/20">
              <span className="text-4xl text-degen-400">🎬</span>
            </div>
            <h2 className="text-xl font-bold text-white">Create a Short</h2>
            <p className="mt-2 text-sm text-gray-400">
              Record a vertical video up to {MAX_DURATION} seconds.
              <br />It will appear in the Shorts feed and be cross-posted everywhere.
            </p>

            {error && (
              <div className="mt-4 w-full rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleStartRecording}
              className="mt-8 flex items-center gap-2 rounded-full bg-degen-500 px-8 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
            >
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Start Recording
            </button>
            <button
              type="button"
              onClick={() => { cleanup(); onClose(); }}
              className="mt-4 text-xs text-gray-500 hover:text-gray-400"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Recording Stage */}
        {stage === 'recording' && (
          <div className="relative aspect-[9/16] bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />

            {/* Timer overlay */}
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-sm font-bold text-white tabular-nums">
                {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                {String(recordingTime % 60).padStart(2, '0')}
              </span>
              <span className="text-xs text-gray-400">/ {MAX_DURATION}s</span>
            </div>

            {/* Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
              {/* Camera toggle */}
              <button
                type="button"
                onClick={toggleCamera}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
                aria-label="Toggle camera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M23 7l-4 4V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-3l4 4V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>

              {/* Stop recording */}
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/10 transition-transform active:scale-90"
                aria-label="Stop recording"
              >
                <span className="h-8 w-8 rounded-md bg-red-500" />
              </button>

              {/* Time indicator */}
              <div className="w-10" />
            </div>
          </div>
        )}

        {/* Preview Stage */}
        {stage === 'preview' && previewUrl && (
          <div className="p-4">
            <div className="relative mx-auto aspect-[9/16] max-h-[60vh] overflow-hidden rounded-xl bg-black">
              <video
                src={previewUrl}
                className="h-full w-full object-cover"
                controls
                playsInline
              />
            </div>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your short..."
                maxLength={80}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-degen-500"
              />

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 rounded-lg bg-gray-800 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Re-record
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!title.trim()}
                  className="flex-1 rounded-lg bg-degen-500 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-40"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Uploading Stage */}
        {stage === 'uploading' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6">
              <svg className="h-12 w-12 animate-spin text-degen-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">Uploading Short...</h3>
            <div className="mt-4 w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Uploading</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Done Stage */}
        {stage === 'done' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/20">
              <span className="text-3xl text-degen-400">✓</span>
            </div>
            <h3 className="text-base font-semibold text-white">Short Uploaded!</h3>
            <p className="mt-2 text-sm text-gray-400">
              Your short is being processed. It will appear in the Shorts feed shortly.
            </p>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={handleReset} className="rounded-lg bg-gray-800 px-6 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700">
                Create Another
              </button>
              <button type="button" onClick={() => { cleanup(); onClose(); }} className="rounded-lg bg-degen-500 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400">
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20">
              <span className="text-3xl text-red-400">!</span>
            </div>
            <h3 className="text-base font-semibold text-red-400">Upload Failed</h3>
            <p className="mt-2 text-sm text-gray-400">{error || 'Something went wrong.'}</p>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={handleReset} className="rounded-lg bg-gray-800 px-6 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700">
                Try Again
              </button>
              <button type="button" onClick={() => { cleanup(); onClose(); }} className="rounded-lg bg-degen-500 px-6 py-2.5 text-sm font-bold text-black">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

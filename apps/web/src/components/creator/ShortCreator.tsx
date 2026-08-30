'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { PublishProgress, type PublishResult } from '../shorts/PublishProgress';
import { buildShareUrl, PROTOCOL_META, type ShortProtocol } from '../shorts/protocolMeta';
import { useCreatorVideoActions } from './useCreatorVideos';

// === Types ===============================================================

interface ShortCreatorProps {
  onClose: () => void;
  onSuccess?: (result: { uuid: string; title: string }) => void;
}

type RecorderStage =
  | 'setup'
  | 'recording'
  | 'preview'
  | 'protocols'
  | 'uploading'
  | 'publishing'
  | 'done'
  | 'error';

interface PublishResponse {
  id: string;
  success: boolean;
  urls: Partial<Record<ShortProtocol, string>>;
  zoraTokenId?: string;
  zoraUrl?: string;
  degenfeedUrl: string;
  tipLink: string;
  errors: Partial<Record<ShortProtocol, string>>;
}

// === Available protocols for selection ===================================

const AVAILABLE_PROTOCOLS: { key: ShortProtocol; label: string; color: string }[] = [
  { key: 'activitypub', label: 'ActivityPub', color: '#6364ff' },
  { key: 'atproto', label: 'AT Protocol', color: '#0085ff' },
  { key: 'nostr', label: 'Nostr', color: '#7c3aed' },
  { key: 'farcaster', label: 'Farcaster', color: '#8b5cf6' },
  { key: 'lens', label: 'Lens', color: '#00501e' },
  { key: 'zora', label: 'Zora', color: '#f5a623' },
];

// === Reach estimate ======================================================

const REACH_ESTIMATES: Record<string, number> = {
  activitypub: 2_500_000,
  atproto: 3_000_000,
  nostr: 1_200_000,
  farcaster: 600_000,
  lens: 400_000,
  zora: 200_000,
  degenfeed: 50_000,
};

// === Short Creator (Mobile-First) ========================================

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
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Protocol selection
  const [selectedProtocols, setSelectedProtocols] = useState<Set<ShortProtocol>>(
    new Set(['activitypub', 'atproto', 'nostr', 'farcaster', 'lens', 'zora']),
  );
  const [mintOnZora, setMintOnZora] = useState(true);

  // Publish state
  const [publishResults, setPublishResults] = useState<Record<string, PublishResult>>({});
  const [publishPending, setPublishPending] = useState<string[]>([]);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [degenfeedUrl, setDegenfeedUrl] = useState<string | null>(null);
  const [zoraUrl, setZoraUrl] = useState<string | null>(null);
  const [tipLink, setTipLink] = useState<string | null>(null);

  const MAX_DURATION = 60;
  const hasZora = selectedProtocols.has('zora');

  // == Derived ==========================================================

  const protocolList = useMemo(
    () => AVAILABLE_PROTOCOLS.filter((p) => selectedProtocols.has(p.key)),
    [selectedProtocols],
  );

  const totalReach = useMemo(() => {
    let total = 0;
    for (const p of selectedProtocols) {
      total += REACH_ESTIMATES[p] ?? 0;
    }
    return total;
  }, [selectedProtocols]);

  // == Toggle protocol ==================================================

  const toggleProtocol = useCallback((protocol: ShortProtocol) => {
    setSelectedProtocols((prev) => {
      const next = new Set(prev);
      if (next.has(protocol)) next.delete(protocol);
      else next.add(protocol);
      return next;
    });
  }, []);

  // == Parse hashtags ===================================================

  const parseHashtags = useCallback(() => {
    return hashtags
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);
  }, [hashtags]);

  // == Start camera =====================================================

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

  // == Stop recording ==================================================

  const handleStopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // == Start recording =================================================

  const handleStartRecording = useCallback(async () => {
    setError(null);
    const stream = await startCamera();
    if (!stream) return;

    if (videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };
    }

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
        stream.getTracks().forEach((t) => {
          t.stop();
        });
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStage('preview');
      };

      recorder.start(1000);

      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed++;
        setRecordingTime(elapsed);
        if (elapsed >= MAX_DURATION) {
          handleStopRecording();
        }
      }, 1000);

      setStage('recording');
    } catch {
      setError('Failed to start recording.');
      stream.getTracks().forEach((t) => {
        t.stop();
      });
    }
  }, [startCamera, handleStopRecording]);

  // == Toggle camera ===================================================

  const toggleCamera = useCallback(() => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // == Go to protocol selection (after preview) ========================

  const handleGoToProtocols = useCallback(() => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setStage('protocols');
    setError(null);
  }, [title]);

  // == Publish (upload then distribute) ================================

  const handlePublish = useCallback(async () => {
    if (!recordedBlob) return;
    if (selectedProtocols.size === 0) {
      setError('Select at least one protocol');
      return;
    }

    setStage('uploading');
    setUploadProgress(0);

    const parsedTags = parseHashtags();

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + Math.random() * 25, 90));
    }, 400);

    try {
      // Step 1: Upload video to storage
      const uploadResult = await uploadShort({
        file: recordedBlob,
        title: title.trim(),
        description: caption.trim(),
        tags: ['short', ...parsedTags],
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const videoUrl = uploadResult.video.url;

      // Step 2: Publish to selected protocols
      setStage('publishing');
      const protocols = [...selectedProtocols];
      setPublishPending(protocols);

      const startedAt = Date.now();

      const res = await fetch('/api/shorts/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          thumbnailUrl: '',
          title: title.trim(),
          caption: caption.trim(),
          hashtags: parsedTags,
          protocols,
          mintOnZora: hasZora ? mintOnZora : false,
          duration: recordingTime > 0 ? recordingTime : 30,
        }),
      });

      const elapsed = Date.now() - startedAt;
      if (elapsed < 1500) await new Promise((r) => setTimeout(r, 1500 - elapsed));

      if (!res.ok && res.status !== 207) {
        const data = (await res.json()) as { error?: string; details?: string };
        throw new Error(data.error ?? data.details ?? `Publish failed (${res.status})`);
      }

      const data = (await res.json()) as PublishResponse;

      const results: Record<string, PublishResult> = {};
      for (const protocol of protocols) {
        if (data.urls[protocol]) {
          results[protocol] = {
            ok: true,
            url: data.urls[protocol],
            protocol: protocol as ShortProtocol,
          };
        } else if (data.errors[protocol]) {
          results[protocol] = {
            ok: false,
            error: data.errors[protocol],
            protocol: protocol as ShortProtocol,
          };
        } else {
          results[protocol] = {
            ok: false,
            error: 'Unknown error',
            protocol: protocol as ShortProtocol,
          };
        }
      }

      if (data.degenfeedUrl && !results.degenfeed) {
        results.degenfeed = { ok: true, url: data.degenfeedUrl, protocol: 'degenfeed' };
      }

      setPublishResults(results);
      setPublishPending([]);
      setPublishId(data.id);
      setDegenfeedUrl(data.degenfeedUrl);
      setZoraUrl(data.zoraUrl ?? null);
      setTipLink(data.tipLink);
      setStage('done');
      onSuccess?.({ uuid: data.id, title: title.trim() });
    } catch (e) {
      setPublishPending([]);
      setStage('error');
      setError(e instanceof Error ? e.message : 'Publish failed');
    }
  }, [
    recordedBlob,
    title,
    caption,
    selectedProtocols,
    mintOnZora,
    hasZora,
    recordingTime,
    parseHashtags,
    uploadShort,
    onSuccess,
  ]);

  // == Reset ===========================================================

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStage('setup');
    setRecordingTime(0);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setTitle('');
    setCaption('');
    setHashtags('');
    setError(null);
    setUploadProgress(0);
    setPublishResults({});
    setPublishPending([]);
    setSelectedProtocols(new Set(['activitypub', 'atproto', 'nostr', 'farcaster', 'lens', 'zora']));
    setMintOnZora(true);
  }, [previewUrl]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => {
        t.stop();
      });
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // == Render helpers =================================================

  function closeButton() {
    if (stage === 'done') return null;
    return (
      <button
        type="button"
        onClick={() => {
          cleanup();
          onClose();
        }}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        aria-label="Close"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    );
  }

  // == Render ==========================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl">
        {closeButton()}

        {/* Setup */}
        {stage === 'setup' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-degen-500/20">
              <span className="text-4xl text-degen-400">🎬</span>
            </div>
            <h2 className="text-xl font-bold text-white">Create a Short</h2>
            <p className="mt-2 text-sm text-gray-400">
              Record a vertical video up to {MAX_DURATION} seconds.
              <br />
              It will be cross-posted to all your selected protocols.
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
              onClick={() => {
                cleanup();
                onClose();
              }}
              className="mt-4 text-xs text-gray-500 hover:text-gray-400"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Recording */}
        {stage === 'recording' && (
          <div className="relative aspect-[9/16] bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-sm font-bold text-white tabular-nums">
                {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                {String(recordingTime % 60).padStart(2, '0')}
              </span>
              <span className="text-xs text-gray-400">/ {MAX_DURATION}s</span>
            </div>
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={toggleCamera}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
                aria-label="Toggle camera"
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M23 7l-4 4V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-3l4 4V7z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/10 transition-transform active:scale-90"
                aria-label="Stop recording"
              >
                <span className="h-8 w-8 rounded-md bg-red-500" />
              </button>
              <div className="w-10" />
            </div>
          </div>
        )}

        {/* Preview */}
        {stage === 'preview' && previewUrl && (
          <div className="p-4">
            <div className="relative mx-auto aspect-[9/16] max-h-[50vh] overflow-hidden rounded-xl bg-black">
              <video src={previewUrl} className="h-full w-full object-cover" controls playsInline>
                <track kind="captions" />
              </video>
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
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)"
                maxLength={280}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-degen-500"
              />
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="Hashtags: defi, nft, trading"
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
                  onClick={handleGoToProtocols}
                  disabled={!title.trim()}
                  className="flex-1 rounded-lg bg-degen-500 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Protocol Selection */}
        {stage === 'protocols' && (
          <div className="p-4">
            <h3 className="text-base font-bold text-white mb-3">Choose where to publish</h3>
            <p className="text-xs text-gray-400 mb-4">
              Your short will be cross-posted to all selected protocols instantly.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {AVAILABLE_PROTOCOLS.map((p) => {
                const active = selectedProtocols.has(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggleProtocol(p.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'border-degen-500/40 bg-degen-500/10 text-degen-400'
                        : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: active ? p.color : 'rgba(255,255,255,0.2)' }}
                    />
                    {p.label}
                    {active && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="text-degen-400"
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-500 mb-3">
              {protocolList.length === 0
                ? 'Select at least one protocol'
                : `~${(totalReach / 1_000_000).toFixed(1)}M potential viewers across ${protocolList.length} protocol${protocolList.length !== 1 ? 's' : ''}`}
            </p>

            {/* Mint as Zora toggle */}
            {hasZora && (
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 mb-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={mintOnZora}
                  onClick={() => setMintOnZora((p) => !p)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    mintOnZora ? 'bg-amber-500' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      mintOnZora ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="flex-1">
                  <span className="text-xs font-medium text-white/80">Mint as Zora NFT</span>
                  <p className="text-[10px] text-white/40">
                    Becomes a tradeable video NFT on Zora Network
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400 mb-3">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage('preview')}
                className="flex-1 rounded-lg bg-gray-800 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={protocolList.length === 0}
                className="flex-1 rounded-lg bg-gradient-to-r from-degen-600 to-degen-500 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-400 disabled:opacity-40"
              >
                Publish to {protocolList.length} protocol{protocolList.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {stage === 'uploading' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6">
              <svg
                aria-hidden="true"
                className="h-12 w-12 animate-spin text-degen-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.3"
                />
                <path
                  d="M12 2a10 10 0 019.95 9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">Uploading Video…</h3>
            <div className="mt-4 w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Uploading to storage</span>
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

        {/* Publishing */}
        {stage === 'publishing' && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/10">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin text-degen-400"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity="0.3"
                  />
                  <path
                    d="M12 2a10 10 0 019.95 9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Distributing everywhere…</h3>
                <p className="text-xs text-white/40">Cross-posting to all selected protocols</p>
              </div>
            </div>

            <PublishProgress
              results={publishResults}
              pending={publishPending}
              totalProtocols={selectedProtocols.size + 1}
              reachEstimate={totalReach}
            />
          </div>
        )}

        {/* Done */}
        {stage === 'done' && (
          <div className="p-4">
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-degen-500/15">
                <span className="text-2xl">🎉</span>
              </div>
              <h3 className="text-base font-bold text-white">Published!</h3>
              <p className="text-center text-xs text-white/50">
                Your short is live across{' '}
                <span className="font-semibold text-white/80">
                  {Object.values(publishResults).filter((r) => r.ok).length} platform
                  {Object.values(publishResults).filter((r) => r.ok).length !== 1 ? 's' : ''}
                </span>
                {totalReach > 0 && (
                  <>
                    {' '}
                    —{' '}
                    <span className="font-semibold text-degen-400">
                      ~{(totalReach / 1_000_000).toFixed(1)}M potential viewers
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Results */}
            {Object.keys(publishResults).length > 0 && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
                <PublishProgress results={publishResults} pending={[]} />
              </div>
            )}

            {/* Share links */}
            {publishId && (
              <div className="mb-3">
                <p className="mb-2 text-xs font-medium text-white/60">Share</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(publishResults)
                    .filter(([_, r]) => r.ok)
                    .map(([protocol]) => {
                      const meta = PROTOCOL_META[protocol as ShortProtocol];
                      if (!meta) return null;
                      return (
                        <a
                          key={protocol}
                          href={buildShareUrl(protocol as ShortProtocol, publishId, title)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 transition-all hover:bg-white/10"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          Share on {meta.shortLabel}
                        </a>
                      );
                    })}
                  {degenfeedUrl && (
                    <a
                      href={degenfeedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-degen-500/30 bg-degen-500/10 px-2.5 py-1 text-[11px] font-medium text-degen-400"
                    >
                      View on DegenFeed
                    </a>
                  )}
                  {zoraUrl && (
                    <a
                      href={zoraUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400"
                    >
                      Collect on Zora
                    </a>
                  )}
                  {tipLink && (
                    <a
                      href={tipLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-400"
                    >
                      ⚡ Tip
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Partial failure notice */}
            {Object.values(publishResults).some((r) => !r.ok) && (
              <div className="rounded-lg bg-red-500/5 px-3 py-2 mb-3">
                <p className="text-[10px] text-red-400/80">
                  Some protocols failed — you can retry from your dashboard.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-lg bg-gray-800 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={() => {
                  cleanup();
                  onClose();
                }}
                className="flex-1 rounded-lg bg-degen-500 py-2.5 text-sm font-bold text-black"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20">
              <span className="text-3xl text-red-400">!</span>
            </div>
            <h3 className="text-base font-semibold text-red-400">Publish Failed</h3>
            <p className="mt-2 text-sm text-gray-400">{error || 'Something went wrong.'}</p>

            {Object.keys(publishResults).length > 0 && (
              <div className="w-full mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <PublishProgress results={publishResults} pending={[]} />
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-gray-800 px-6 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  cleanup();
                  onClose();
                }}
                className="rounded-lg bg-degen-500 px-6 py-2.5 text-sm font-bold text-black"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

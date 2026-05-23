'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPresignedUploadUrl, createRecording } from '../lib/webApi';

type RecState = 'idle' | 'recording' | 'paused' | 'stopped' | 'uploading';

export default function NewRecordingPage() {
  const router = useRouter();
  const [state, setState] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ phase: string; pct?: number } | null>(null);
  const [title, setTitle] = useState(defaultTitle());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        blobRef.current = blob;
        setState('stopped');
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      setState('recording');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Impossibile accedere al microfono');
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setState('paused');
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    startedAtRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    setState('recording');
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function discard() {
    blobRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setState('idle');
    setTitle(defaultTitle());
  }

  async function uploadAndSave(blob: Blob, filename: string, durationSeconds: number) {
    setState('uploading');
    setProgress({ phase: 'Preparo upload…' });
    try {
      const ext = mimeToExt(blob.type);
      const finalName = filename || `${defaultTitle()}.${ext}`;
      const { url, key } = await getPresignedUploadUrl(finalName, blob.type || 'audio/mp4');
      setProgress({ phase: 'Carico file…', pct: 0 });
      await uploadWithProgress(url, blob, (p) => setProgress({ phase: 'Carico file…', pct: p }));
      setProgress({ phase: 'Salvo record…' });
      const created = await createRecording({
        title: title.trim() || finalName,
        recordedAt: new Date().toISOString(),
        durationSeconds,
        audioUrl: key,
        source: blob === blobRef.current ? 'recording' : 'import',
      });
      router.replace(`/r/${created.id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Upload fallito');
      setState('stopped');
      setProgress(null);
    }
  }

  async function saveRecorded() {
    if (!blobRef.current) return;
    await uploadAndSave(blobRef.current, `${title.replace(/[\\/:*?"<>|]/g, '_')}.${mimeToExt(blobRef.current.type)}`, elapsed);
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitle(defaultTitleFromName(file.name));
    await uploadAndSave(file, file.name, 0);
  }

  const formatted = formatTime(elapsed);

  return (
    <main style={styles.shell}>
      <Link href="/" style={styles.back}>‹ Recy</Link>
      <h1 style={styles.title}>Nuova registrazione</h1>

      {error && <div style={styles.error}>{error}</div>}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titolo"
        style={styles.titleInput}
      />

      <div style={styles.recCard}>
        <div style={styles.timerText}>{formatted}</div>

        {state === 'idle' && (
          <button onClick={startRecording} style={styles.recordButton}>
            <div style={styles.recordCircle} />
            <span>Avvia registrazione</span>
          </button>
        )}

        {(state === 'recording' || state === 'paused') && (
          <div style={styles.controlsRow}>
            <button
              onClick={state === 'recording' ? pauseRecording : resumeRecording}
              style={styles.secondaryCircle}
              aria-label={state === 'recording' ? 'Pausa' : 'Riprendi'}
            >
              {state === 'recording' ? '❚❚' : '▶'}
            </button>
            <button onClick={stopRecording} style={styles.stopCircle} aria-label="Stop">
              <div style={styles.stopSquare} />
            </button>
          </div>
        )}

        {state === 'stopped' && (
          <div style={styles.controlsRow}>
            <button onClick={discard} style={styles.ghostButton}>Scarta</button>
            <button onClick={saveRecorded} style={styles.primaryButton}>Salva</button>
          </div>
        )}

        {state === 'uploading' && progress && (
          <div style={{ width: '100%', textAlign: 'center', color: 'var(--secondary)' }}>
            {progress.phase}
            {typeof progress.pct === 'number' && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress.pct}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={styles.dividerRow}>
        <div style={styles.divider} />
        <span style={styles.dividerText}>oppure</span>
        <div style={styles.divider} />
      </div>

      <label style={styles.importButton}>
        Importa un file audio o video
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={onFilePicked}
          style={{ display: 'none' }}
        />
      </label>
    </main>
  );
}

function defaultTitle(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}-`;
}

function defaultTitleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function pickMimeType(): string | null {
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return null;
}

function mimeToExt(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  return 'audio';
}

function uploadWithProgress(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', blob.type || 'audio/mp4');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 ${xhr.status}: ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('Errore di rete'));
    xhr.send(blob);
  });
}

const styles: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 640, margin: '0 auto', padding: '24px 24px 60px' },
  back: { color: 'var(--accent)', fontSize: 16, display: 'inline-block', marginBottom: 16 },
  title: { fontSize: 30, fontWeight: 700, letterSpacing: -0.5, marginBottom: 20 },
  error: { background: '#FEF2F2', color: 'var(--red)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14 },
  titleInput: {
    width: '100%', padding: '12px 14px', border: '1px solid var(--sep)', borderRadius: 10,
    fontSize: 16, marginBottom: 20, background: 'var(--card)', color: 'var(--label)', outline: 'none',
  },
  recCard: {
    background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
  },
  timerText: { fontSize: 56, fontWeight: 300, letterSpacing: -1.5, fontVariant: 'tabular-nums', color: 'var(--label)' },
  recordButton: {
    background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12, color: 'var(--label)', fontSize: 15, fontWeight: 500,
  },
  recordCircle: {
    width: 72, height: 72, borderRadius: 36, background: 'var(--red)',
    border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  stopCircle: {
    width: 72, height: 72, borderRadius: 36, background: 'var(--red)',
    border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  stopSquare: { width: 22, height: 22, background: 'white', borderRadius: 4 },
  secondaryCircle: {
    width: 56, height: 56, borderRadius: 28, background: 'var(--card)',
    border: '1px solid var(--sep)', fontSize: 18, color: 'var(--label)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)', cursor: 'pointer',
  },
  controlsRow: { display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center' },
  ghostButton: {
    background: 'transparent', border: '1px solid var(--sep)', borderRadius: 10,
    padding: '12px 22px', fontSize: 15, color: 'var(--label)', fontWeight: 500, cursor: 'pointer',
  },
  primaryButton: {
    background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10,
    padding: '12px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  progressBar: { height: 6, background: 'var(--sep)', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', transition: 'width 0.2s ease' },
  dividerRow: { display: 'flex', alignItems: 'center', gap: 14, margin: '32px 0' },
  divider: { flex: 1, height: 1, background: 'var(--sep)' },
  dividerText: { color: 'var(--secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 500 },
  importButton: {
    display: 'block', textAlign: 'center', background: 'var(--card)', borderRadius: 12,
    padding: '18px 16px', border: '1.5px dashed var(--tertiary)', cursor: 'pointer',
    color: 'var(--label)', fontWeight: 500, fontSize: 15,
  },
};

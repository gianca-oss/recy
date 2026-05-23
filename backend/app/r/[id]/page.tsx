'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  getRecording, getRecordingAudio, transcribeRecording,
  summarizeRecording, updateRecording, deleteRecording,
  ApiRecordingFull,
} from '../../lib/webApi';

export default function RecordingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [rec, setRec] = useState<ApiRecordingFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTranscript, setDraftTranscript] = useState('');
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecording(id);
      setRec(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!rec?.audioUrl) return;
    getRecordingAudio(rec.id).then((info) => setAudioUrl(info.url)).catch(() => {});
  }, [rec?.id, rec?.audioUrl]);

  // Poll while transcribing/summarizing
  useEffect(() => {
    if (!rec) return;
    const inProgress = rec.status === 'transcribing' || (rec.summarizationStartedAt && !rec.summary);
    if (!inProgress) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [rec?.status, rec?.summarizationStartedAt, rec?.summary, load]);

  if (loading && !rec) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--secondary)' }}>Caricamento…</div>;
  if (!rec) return <div style={{ padding: 40 }}>Registrazione non trovata. <Link href="/">Torna alla home</Link></div>;

  const displayedTranscript = rec.transcriptEdited ?? rec.transcriptVerbatim ?? null;
  const canTranscribe = !displayedTranscript && rec.status !== 'transcribing';
  const canSummarize = displayedTranscript && !rec.summary && !rec.summarizationStartedAt;
  const isTranscribing = rec.status === 'transcribing' || transcribing;
  const isSummarizing = (!!rec.summarizationStartedAt && !rec.summary) || summarizing;

  async function doTranscribe() {
    setTranscribing(true);
    try {
      await transcribeRecording(id);
      await load();
    } finally {
      setTranscribing(false);
    }
  }

  async function doSummarize() {
    setSummarizing(true);
    try {
      await summarizeRecording(id);
      await load();
    } finally {
      setSummarizing(false);
    }
  }

  async function saveTitle() {
    if (!draftTitle.trim()) return;
    await updateRecording(id, { title: draftTitle.trim() });
    setEditingTitle(false);
    await load();
  }

  async function saveTranscript() {
    await updateRecording(id, { transcriptEdited: draftTranscript });
    setEditingTranscript(false);
    await load();
  }

  async function doDelete() {
    if (!confirm(`Eliminare "${rec.title}"?`)) return;
    await deleteRecording(id);
    router.push('/');
  }

  function seekTo(seconds: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = seconds;
    a.play().catch(() => {});
  }

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadFull() {
    const lines: string[] = [];
    lines.push(`# ${rec!.title}\n`);
    lines.push(`Registrata: ${new Date(rec!.recordedAt).toLocaleString('it-IT')}\n`);
    if (rec!.summary) lines.push(`\n## Riassunto\n\n${rec!.summary}\n`);
    if (displayedTranscript) lines.push(`\n## Trascrizione\n\n${displayedTranscript}\n`);
    const safe = rec!.title.replace(/[\\/:*?"<>|]/g, '_');
    downloadText(lines.join(''), `${safe}-full.md`);
  }

  const segments = rec.transcriptSegments;
  const hasEdits = rec.transcriptEdited && rec.transcriptEdited !== rec.transcriptVerbatim;

  return (
    <main style={styles.shell}>
      <Link href="/" style={styles.back}>‹ Recy</Link>

      {editingTitle ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            style={styles.titleInput}
            autoFocus
          />
          <button onClick={saveTitle} style={styles.smallButton}>Salva</button>
          <button onClick={() => setEditingTitle(false)} style={styles.smallButtonGhost}>Annulla</button>
        </div>
      ) : (
        <h1
          style={styles.title}
          onClick={() => { setDraftTitle(rec.title); setEditingTitle(true); }}
        >
          {rec.title}
        </h1>
      )}
      <div style={styles.meta}>
        {new Date(rec.recordedAt).toLocaleString('it-IT')}
        {rec.durationSeconds ? ` · ${formatDur(rec.durationSeconds)}` : ''}
      </div>

      {audioUrl && (
        <div style={styles.playerCard}>
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            style={{ width: '100%' }}
            onTimeUpdate={(e) => {
              const t = (e.target as HTMLAudioElement).currentTime;
              if (!segments) return;
              const i = segments.findIndex((s) => s.start <= t && s.end >= t);
              setCurrentWordIdx(i);
            }}
          />
        </div>
      )}

      {isTranscribing && (
        <div style={styles.statusBox}>Trascrizione in corso sul server…</div>
      )}

      {canTranscribe && !isTranscribing && (
        <button onClick={doTranscribe} style={styles.primaryButton}>
          Trascrivi
        </button>
      )}

      {displayedTranscript && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardLabel}>Trascrizione{hasEdits ? ' · modificata' : ''}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {!editingTranscript && (
                <button
                  onClick={() => {
                    setDraftTranscript(displayedTranscript);
                    setEditingTranscript(true);
                  }}
                  style={styles.linkButton}
                >
                  Modifica
                </button>
              )}
              <button
                onClick={() => downloadText(displayedTranscript, `${rec.title.replace(/[\\/:*?"<>|]/g, '_')}-raw.txt`)}
                style={styles.linkButton}
              >
                Scarica
              </button>
            </div>
          </div>
          {editingTranscript ? (
            <>
              <textarea
                value={draftTranscript}
                onChange={(e) => setDraftTranscript(e.target.value)}
                style={styles.textarea}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={saveTranscript} style={styles.primaryButtonSmall}>Salva</button>
                <button onClick={() => setEditingTranscript(false)} style={styles.smallButtonGhost}>Annulla</button>
              </div>
            </>
          ) : segments && segments.length > 0 && !hasEdits ? (
            <div style={styles.transcriptBox}>
              {segments.map((s, i) => (
                <span
                  key={i}
                  onClick={() => seekTo(s.start)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: i === currentWordIdx ? 'var(--accent)' : 'transparent',
                    color: i === currentWordIdx ? 'white' : 'inherit',
                    borderRadius: 3,
                    padding: '1px 2px',
                  }}
                >
                  {s.text}
                </span>
              ))}
            </div>
          ) : (
            <div style={styles.transcriptBox}>{displayedTranscript}</div>
          )}
        </section>
      )}

      {isSummarizing && (
        <div style={styles.statusBox}>Riassunto in corso sul server…</div>
      )}

      {canSummarize && !isSummarizing && (
        <button onClick={doSummarize} style={styles.primaryButton}>
          Genera riassunto
        </button>
      )}

      {rec.summary && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardLabel}>Riassunto</div>
            <button
              onClick={() => downloadText(rec.summary!, `${rec.title.replace(/[\\/:*?"<>|]/g, '_')}-summary.md`)}
              style={styles.linkButton}
            >
              Scarica
            </button>
          </div>
          <div style={styles.transcriptBox}>{rec.summary}</div>
        </section>
      )}

      {(displayedTranscript || rec.summary) && (
        <button onClick={downloadFull} style={styles.secondaryButton}>
          Esporta tutto (.md)
        </button>
      )}

      <button onClick={doDelete} style={styles.dangerButton}>
        Elimina registrazione
      </button>
    </main>
  );
}

function formatDur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

const styles: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 860, margin: '0 auto', padding: '24px 24px 60px' },
  back: { color: 'var(--accent)', fontSize: 16, display: 'inline-block', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6, cursor: 'pointer' },
  titleInput: { flex: 1, fontSize: 28, fontWeight: 700, padding: '6px 10px', border: '1px solid var(--sep)', borderRadius: 10, background: 'var(--card)' },
  meta: { fontSize: 14, color: 'var(--secondary)', marginBottom: 24 },
  playerCard: {
    background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  statusBox: {
    background: 'var(--card)', padding: 14, borderRadius: 12,
    border: '1px solid var(--sep)', marginBottom: 16, color: 'var(--secondary)',
  },
  primaryButton: {
    background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10,
    padding: '12px 18px', fontSize: 15, fontWeight: 600, marginBottom: 16,
  },
  primaryButtonSmall: {
    background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8,
    padding: '8px 14px', fontSize: 14, fontWeight: 600,
  },
  secondaryButton: {
    background: 'var(--card)', color: 'var(--accent)', border: '1px solid var(--sep)',
    borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 600, marginTop: 16, marginRight: 10,
  },
  dangerButton: {
    background: 'var(--card)', color: 'var(--red)', border: '1px solid #FECACA',
    borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 600, marginTop: 16,
  },
  card: { background: 'var(--card)', borderRadius: 12, padding: 18, marginBottom: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: {
    fontSize: 13, color: 'var(--secondary)', textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: 600,
  },
  linkButton: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 500, padding: 0 },
  smallButton: { background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600 },
  smallButtonGhost: { background: 'transparent', border: 'none', color: 'var(--secondary)', fontSize: 14, padding: '8px 6px' },
  textarea: {
    width: '100%', minHeight: 240, padding: 12, border: '1px solid var(--sep)',
    borderRadius: 8, fontSize: 15, lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit',
  },
  transcriptBox: { fontSize: 16, lineHeight: 1.6, color: 'var(--label)', whiteSpace: 'pre-wrap' },
};

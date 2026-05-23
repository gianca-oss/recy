'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getApiKey, setApiKey, clearApiKey, ping, listRecordings,
  ApiRecording,
} from './lib/webApi';

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [items, setItems] = useState<ApiRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRecordings();
      setItems(data);
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ping();
      setAuthed(ok);
      if (ok) await load();
    })();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setKeyError(null);
    setApiKey(keyDraft.trim());
    const ok = await ping();
    if (ok) {
      setAuthed(true);
      await load();
    } else {
      setKeyError('Chiave non valida o backend non raggiungibile');
      clearApiKey();
    }
  }

  if (authed === null) {
    return <CenterMessage text="Caricamento…" />;
  }

  if (!authed) {
    return (
      <main style={loginStyles.shell}>
        <div style={loginStyles.card}>
          <h1 style={loginStyles.title}>Recy</h1>
          <p style={loginStyles.subtitle}>
            Inserisci la chiave API per accedere alle tue registrazioni.
          </p>
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <input
              autoFocus
              type="password"
              placeholder="API key"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              style={loginStyles.input}
            />
            <button type="submit" style={loginStyles.submit}>
              Entra
            </button>
            {keyError && <p style={loginStyles.error}>{keyError}</p>}
          </form>
        </div>
      </main>
    );
  }

  const filtered = query.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <main style={dashStyles.shell}>
      <header style={dashStyles.header}>
        <h1 style={dashStyles.brand}>Recy</h1>
        <input
          placeholder="Cerca"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={dashStyles.search}
        />
        <Link href="/new" style={dashStyles.newButton}>+ Nuova</Link>
        <button
          style={dashStyles.logout}
          onClick={() => { clearApiKey(); setAuthed(false); }}
        >
          Esci
        </button>
      </header>

      {loading && items.length === 0 ? (
        <CenterMessage text="Caricamento registrazioni…" />
      ) : filtered.length === 0 ? (
        <CenterMessage text={query ? 'Nessun risultato' : 'Nessuna registrazione'} />
      ) : (
        <ul style={dashStyles.list}>
          {filtered.map((r) => (
            <li key={r.id} style={dashStyles.item}>
              <Link href={`/r/${r.id}`} style={dashStyles.itemLink}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={dashStyles.itemTitle}>{r.title}</div>
                  <div style={dashStyles.itemMeta}>
                    {formatDate(r.recordedAt)} · {formatDuration(r.durationSeconds)}
                    {' · '}
                    <SyncBadge state={r.syncState} status={r.status} summarizing={!!r.summarizationStartedAt} />
                  </div>
                </div>
                <span style={dashStyles.chevron}>›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function SyncBadge({ state, status, summarizing }: { state: string; status: string; summarizing: boolean }) {
  if (status === 'transcribing') return <span style={{ color: 'var(--accent)' }}>Trascrizione…</span>;
  if (summarizing) return <span style={{ color: 'var(--accent)' }}>Riassunto…</span>;
  if (state === 'summarized') return <span>con riassunto</span>;
  if (state === 'transcribed') return <span>trascritta</span>;
  if (state === 'uploaded') return <span>caricata</span>;
  return <span>locale</span>;
}

function CenterMessage({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--secondary)' }}>
      {text}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

const loginStyles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: 'var(--card)',
    padding: 36,
    borderRadius: 16,
    boxShadow: '0 12px 40px rgba(0,0,0,0.06)',
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 32, fontWeight: 700, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'var(--secondary)', textAlign: 'center', marginBottom: 16 },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid var(--sep)',
    borderRadius: 10,
    fontSize: 16,
    outline: 'none',
    background: 'var(--bg)',
    color: 'var(--label)',
    marginBottom: 10,
  },
  submit: {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
  },
  error: { color: 'var(--red)', fontSize: 13, marginTop: 10, textAlign: 'center' },
};

const dashStyles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '32px 24px 60px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  brand: { fontSize: 30, fontWeight: 700, letterSpacing: -0.5, flexShrink: 0 },
  search: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid var(--sep)',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
    background: 'var(--card)',
  },
  newButton: {
    background: 'var(--accent)',
    color: 'white',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
  },
  logout: {
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 15,
    fontWeight: 500,
  },
  list: { listStyle: 'none' },
  item: {
    background: 'var(--card)',
    borderRadius: 12,
    marginBottom: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  itemLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 18px',
    gap: 14,
  },
  itemTitle: { fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--label)' },
  itemMeta: { fontSize: 13, color: 'var(--secondary)' },
  chevron: { color: 'var(--tertiary)', fontSize: 22 },
};

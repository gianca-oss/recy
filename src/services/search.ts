import type { Recording } from '../types';

export interface SearchMatch {
  recording: Recording;
  field: 'title' | 'transcript';
  snippet: string;
  matchIndex: number;
}

const SNIPPET_RADIUS = 50;

function makeSnippet(text: string, idx: number, q: string): string {
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + q.length + SNIPPET_RADIUS);
  let snip = text.slice(start, end);
  if (start > 0) snip = '…' + snip;
  if (end < text.length) snip = snip + '…';
  return snip;
}

export function searchRecordings(
  recordings: Recording[],
  query: string
): SearchMatch[] {
  const q = query.trim();
  if (!q) return [];
  const lcq = q.toLowerCase();
  const results: SearchMatch[] = [];

  for (const rec of recordings) {
    const titleIdx = rec.title.toLowerCase().indexOf(lcq);
    if (titleIdx >= 0) {
      results.push({
        recording: rec,
        field: 'title',
        snippet: rec.title,
        matchIndex: titleIdx,
      });
      continue;
    }
    const transcript = rec.transcriptEdited || rec.transcript;
    if (transcript) {
      const idx = transcript.toLowerCase().indexOf(lcq);
      if (idx >= 0) {
        results.push({
          recording: rec,
          field: 'transcript',
          snippet: makeSnippet(transcript, idx, q),
          matchIndex: idx,
        });
      }
    }
  }

  results.sort((a, b) => {
    const dateB = new Date(b.recording.recordedAt).getTime();
    const dateA = new Date(a.recording.recordedAt).getTime();
    return dateB - dateA;
  });

  return results;
}

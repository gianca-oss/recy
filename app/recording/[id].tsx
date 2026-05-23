import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Colors, Fonts } from '../../src/theme';
import { getAllRecordings, updateRecording } from '../../src/stores/recordingStore';
import { transcribeRecording, summarizeRecording, getRecording, getRecordingAudioInfo, updateRecording as updateRemoteRecording } from '../../src/services/api';
import { deleteRecordingFully } from '../../src/services/deleteRecording';
import type { Recording, TranscriptSegment } from '../../src/types';

export default function RecordingDetailScreen() {
  const router = useRouter();
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [progress, setProgress] = useState<{ elapsed: number; sizeBytes: number | null }>({ elapsed: 0, sizeBytes: null });
  const [summaryElapsed, setSummaryElapsed] = useState(0);

  // Audio player state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const transcribing = recording?.status === 'transcribing';
  const transcriptionStartedAt = recording?.transcriptionStartedAt ?? null;
  const summarizing = !!recording?.summarizationStartedAt && !recording?.summary;
  const summarizationStartedAt = recording?.summarizationStartedAt ?? null;
  const scrollRef = useRef<ScrollView>(null);
  const transcriptY = useRef(0);
  const scrolledRef = useRef(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [savingTranscript, setSavingTranscript] = useState(false);

  const load = useCallback(async () => {
    const all = await getAllRecordings();
    const found = all.find((r) => r.id === id);
    setRecording(found ?? null);
    return found ?? null;
  }, [id]);

  const syncFromServer = useCallback(async (rec: Recording | null) => {
    if (!rec?.serverId) return null;
    try {
      const server = await getRecording(rec.serverId);
      const patch: Partial<Recording> = {
        status: server.status ?? rec.status,
        transcript: server.transcriptVerbatim ?? rec.transcript ?? null,
        transcriptEdited: server.transcriptEdited ?? rec.transcriptEdited ?? null,
        transcriptSegments: server.transcriptSegments ?? rec.transcriptSegments ?? null,
        summary: server.summary ?? rec.summary ?? null,
        transcriptFetchedAt: new Date().toISOString(),
        transcriptionStartedAt: server.transcriptionStartedAt ?? null,
        summarizationStartedAt: server.summarizationStartedAt ?? null,
      };
      if (server.title && server.title !== rec.title) patch.title = server.title;
      await updateRecording(rec.id, patch);
      const updated = await load();
      return updated;
    } catch (err) {
      // offline / server error — keep local cache
      console.log('Background server sync failed:', err);
      return null;
    }
  }, [load]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const rec = await load();
      const synced = await syncFromServer(rec);
      const current = synced ?? rec;
      const needsPolling = current?.status === 'transcribing'
        || (current?.summarizationStartedAt && !current?.summary);
      if (current?.status === 'transcribing' && current.serverId) {
        getRecordingAudioInfo(current.serverId)
          .then((info) => !cancelled && setProgress((p) => ({ ...p, sizeBytes: info.size })))
          .catch(() => {});
      }
      if (needsPolling) {
        pollTimer = setInterval(async () => {
          if (cancelled) return;
          const fresh = await syncFromServer(current);
          const still = fresh && (
            fresh.status === 'transcribing' ||
            (fresh.summarizationStartedAt && !fresh.summary)
          );
          if (!still && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
            setProgress({ elapsed: 0, sizeBytes: null });
          }
        }, 3000);
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [load, syncFromServer]));

  useEffect(() => {
    if (!transcribing || !transcriptionStartedAt) return;
    const startMs = new Date(transcriptionStartedAt).getTime();
    const update = () => setProgress((p) => ({
      ...p,
      elapsed: Math.max(0, Math.floor((Date.now() - startMs) / 1000)),
    }));
    update();
    const tick = setInterval(update, 1000);
    return () => clearInterval(tick);
  }, [transcribing, transcriptionStartedAt]);

  useEffect(() => {
    if (!summarizing || !summarizationStartedAt) {
      setSummaryElapsed(0);
      return;
    }
    const startMs = new Date(summarizationStartedAt).getTime();
    const update = () => setSummaryElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    update();
    const tick = setInterval(update, 1000);
    return () => clearInterval(tick);
  }, [summarizing, summarizationStartedAt]);

  // Pre-fetch audio metadata so size + estimated duration are visible
  // even before tapping Trascrivi.
  useEffect(() => {
    if (!recording?.serverId) return;
    if (progress.sizeBytes !== null) return;
    if (recording.syncState === 'local_only') return;
    getRecordingAudioInfo(recording.serverId)
      .then((info) => setProgress((p) => ({ ...p, sizeBytes: info.size })))
      .catch(() => {});
  }, [recording?.serverId, recording?.syncState, progress.sizeBytes]);

  useEffect(() => {
    return () => {
      // Unload audio when leaving the screen
      const sound = soundRef.current;
      if (sound) {
        soundRef.current = null;
        sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  async function ensureAudioLoaded(): Promise<Audio.Sound | null> {
    if (soundRef.current) return soundRef.current;
    if (!recording?.serverId) return null;
    setAudioLoading(true);
    try {
      const info = await getRecordingAudioInfo(recording.serverId);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: info.url },
        { shouldPlay: false }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setPositionMs(status.positionMillis ?? 0);
        setDurationMs(status.durationMillis ?? 0);
        setIsPlaying(status.isPlaying);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPositionMs(0);
          sound.setPositionAsync(0).catch(() => {});
        }
      });
      soundRef.current = sound;
      setAudioLoaded(true);
      return sound;
    } catch (err) {
      console.error('Audio load failed', err);
      Alert.alert('Errore', 'Impossibile caricare l\'audio.');
      return null;
    } finally {
      setAudioLoading(false);
    }
  }

  async function togglePlayPause() {
    const sound = await ensureAudioLoaded();
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }

  async function seekToSeconds(seconds: number, andPlay = true) {
    const sound = await ensureAudioLoaded();
    if (!sound) return;
    await sound.setPositionAsync(Math.floor(seconds * 1000));
    if (andPlay) await sound.playAsync();
  }

  // Track current word during playback
  useEffect(() => {
    const segments = recording?.transcriptSegments;
    if (!segments || segments.length === 0) {
      setCurrentWordIdx(-1);
      return;
    }
    const t = positionMs / 1000;
    let lo = 0, hi = segments.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const seg = segments[mid];
      if (t < seg.start) hi = mid - 1;
      else if (t > seg.end) lo = mid + 1;
      else { found = mid; break; }
    }
    setCurrentWordIdx(found);
  }, [positionMs, recording?.transcriptSegments]);

  function handleDelete() {
    if (!recording) return;
    Alert.alert(
      'Elimina registrazione',
      `Sei sicuro di voler eliminare "${recording.title}"? Questa azione non può essere annullata.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecordingFully(recording);
              router.replace('/');
            } catch (err) {
              Alert.alert('Errore', `Impossibile eliminare: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
            }
          },
        },
      ]
    );
  }

  async function exportText(content: string, suffix: 'raw' | 'summary', ext: 'txt' | 'md') {
    if (!recording) return;
    const safeTitle = (recording.title || 'registrazione')
      .replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${safeTitle}-${suffix}.${ext}`;
    try {
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Share.share({
        title: filename,
        url: path,
      });
    } catch (err) {
      console.error('Export error', err);
      Alert.alert('Errore', 'Impossibile esportare il file.');
    }
  }

  async function handleSummarize() {
    if (!recording?.serverId) {
      Alert.alert('Impossibile riassumere', 'La registrazione non è ancora sul cloud.');
      return;
    }
    try {
      await summarizeRecording(recording.serverId);
      await syncFromServer(recording);
    } catch (err) {
      console.error('Summarize error', err);
      Alert.alert('Errore', `Avvio riassunto fallito: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
    }
  }

  async function handleTranscribe() {
    if (!recording?.serverId) {
      Alert.alert('Impossibile trascrivere', 'La registrazione non è stata ancora caricata sul cloud.');
      return;
    }
    try {
      await transcribeRecording(recording.serverId);
      setProgress({ elapsed: 0, sizeBytes: null });
      await syncFromServer(recording);
      getRecordingAudioInfo(recording.serverId)
        .then((info) => setProgress((p) => ({ ...p, sizeBytes: info.size })))
        .catch(() => {});
    } catch (err) {
      console.error('Transcribe error', err);
      Alert.alert('Errore', `Avvio trascrizione fallito: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
    }
  }

  function startEditTitle() {
    if (!recording) return;
    setTitleDraft(recording.title);
    setEditingTitle(true);
  }

  async function saveTitle() {
    if (!recording) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      Alert.alert('Titolo vuoto', 'Inserisci un titolo.');
      return;
    }
    setSavingTitle(true);
    try {
      await updateRecording(recording.id, { title: trimmed });
      if (recording.serverId) {
        await updateRemoteRecording(recording.serverId, { title: trimmed }).catch(console.log);
      }
      await load();
      setEditingTitle(false);
    } catch (err) {
      Alert.alert('Errore', 'Impossibile salvare il titolo.');
    } finally {
      setSavingTitle(false);
    }
  }

  function startEditTranscript() {
    if (!recording) return;
    setTranscriptDraft(recording.transcriptEdited ?? recording.transcript ?? '');
    setEditingTranscript(true);
  }

  async function saveTranscript() {
    if (!recording) return;
    setSavingTranscript(true);
    try {
      await updateRecording(recording.id, { transcriptEdited: transcriptDraft });
      if (recording.serverId) {
        await updateRemoteRecording(recording.serverId, { transcriptEdited: transcriptDraft }).catch(console.log);
      }
      await load();
      setEditingTranscript(false);
    } catch (err) {
      Alert.alert('Errore', 'Impossibile salvare la trascrizione.');
    } finally {
      setSavingTranscript(false);
    }
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  if (!recording) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>Caricamento…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayedTranscript = recording.transcriptEdited ?? recording.transcript ?? null;
  const canTranscribe = recording.syncState === 'uploaded' && !displayedTranscript;
  const canSummarize = !!displayedTranscript && !recording.summary && !!recording.serverId && !summarizing;
  const hasEdits = recording.transcriptEdited && recording.transcriptEdited !== recording.transcript;
  const highlight = typeof q === 'string' && q.length > 0 ? q : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={Colors.accent} />
            <Text style={styles.backText}>Recy</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {editingTitle ? (
            <View style={styles.titleEditRow}>
              <TextInput
                style={styles.titleInput}
                value={titleDraft}
                onChangeText={setTitleDraft}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveTitle}
              />
              <TouchableOpacity onPress={() => setEditingTitle(false)} hitSlop={8}>
                <Ionicons name="close" size={26} color={Colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveTitle} hitSlop={8} disabled={savingTitle}>
                {savingTitle
                  ? <ActivityIndicator color={Colors.accent} />
                  : <Ionicons name="checkmark" size={28} color={Colors.accent} />}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={startEditTitle} activeOpacity={0.6}>
              <Text style={styles.title}>{recording.title}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.meta}>{formatDuration(recording.durationSeconds)}</Text>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Ionicons
                name={
                  recording.syncState === 'local_only' ? 'cloud-offline-outline' :
                  recording.syncState === 'uploaded' ? 'cloud-done-outline' :
                  'checkmark-circle'
                }
                size={18}
                color={recording.syncState === 'local_only' ? '#F59E0B' : '#10B981'}
              />
              <Text style={styles.statusText}>
                {recording.syncState === 'local_only' && 'Solo sul dispositivo'}
                {recording.syncState === 'uploaded' && 'Caricata'}
                {recording.syncState === 'transcribed' && 'Trascritta'}
                {recording.syncState === 'summarized' && 'Con riassunto'}
              </Text>
            </View>
          </View>

          {canTranscribe && !transcribing && (
            <>
              <AudioInfoCard
                sizeBytes={progress.sizeBytes}
                durationSeconds={recording.durationSeconds}
              />
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleTranscribe}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={18} color={Colors.white} />
                <Text style={styles.actionButtonText}>Trascrivi</Text>
              </TouchableOpacity>
            </>
          )}

          {transcribing && (
            <TranscribeProgressCard
              elapsed={progress.elapsed}
              sizeBytes={progress.sizeBytes}
              durationSeconds={recording.durationSeconds}
            />
          )}

          {displayedTranscript !== null && recording.serverId && (
            <AudioPlayerBar
              isLoading={audioLoading}
              isPlaying={isPlaying}
              position={positionMs}
              duration={durationMs}
              onTogglePlay={togglePlayPause}
              onSeek={seekToSeconds}
            />
          )}

          {displayedTranscript !== null && (
            <View
              style={styles.transcriptCard}
              onLayout={(e) => {
                transcriptY.current = e.nativeEvent.layout.y;
                if (highlight && !scrolledRef.current) {
                  scrolledRef.current = true;
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: transcriptY.current - 12, animated: true });
                  }, 150);
                }
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.sectionLabel}>
                  Trascrizione{hasEdits ? ' · modificata' : ''}
                </Text>
                <View style={styles.cardHeaderActions}>
                  {!editingTranscript && (
                    <TouchableOpacity onPress={startEditTranscript} hitSlop={8}>
                      <Text style={styles.editLink}>Modifica</Text>
                    </TouchableOpacity>
                  )}
                  {!editingTranscript && (
                    <TouchableOpacity
                      onPress={() => exportText(displayedTranscript, 'raw', 'txt')}
                      hitSlop={8}
                    >
                      <Ionicons name="share-outline" size={20} color={Colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {editingTranscript ? (
                <>
                  <TextInput
                    style={styles.transcriptInput}
                    value={transcriptDraft}
                    onChangeText={setTranscriptDraft}
                    multiline
                    textAlignVertical="top"
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingTranscript(false)}
                      disabled={savingTranscript}
                    >
                      <Text style={styles.cancelButtonText}>Annulla</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, savingTranscript && { opacity: 0.6 }]}
                      onPress={saveTranscript}
                      disabled={savingTranscript}
                    >
                      {savingTranscript
                        ? <ActivityIndicator color={Colors.white} size="small" />
                        : <Text style={styles.saveButtonText}>Salva</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.transcriptScrollBox}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    persistentScrollbar
                  >
                    {recording.transcriptSegments && recording.transcriptSegments.length > 0 && !hasEdits ? (
                      <TappableTranscript
                        segments={recording.transcriptSegments}
                        currentIdx={currentWordIdx}
                        highlight={highlight}
                        onWordPress={(start) => seekToSeconds(start, true)}
                      />
                    ) : (
                      <HighlightedText
                        text={displayedTranscript}
                        query={highlight}
                        style={styles.transcriptText}
                      />
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {canSummarize && !summarizing && (
            <TouchableOpacity
              style={[styles.actionButton, styles.summaryButton]}
              onPress={handleSummarize}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles-outline" size={18} color={Colors.white} />
              <Text style={styles.actionButtonText}>Genera riassunto</Text>
            </TouchableOpacity>
          )}

          {summarizing && (
            <View style={[styles.progressCard, { marginTop: 16, marginBottom: 0 }]}>
              <View style={styles.progressHeader}>
                <ActivityIndicator color={Colors.accent} size="small" />
                <Text style={styles.progressTitle}>Riassunto in corso</Text>
              </View>
              <View style={styles.progressMeta}>
                <View style={styles.progressMetaItem}>
                  <Text style={styles.progressMetaLabel}>Trascorsi</Text>
                  <Text style={styles.progressMetaValue}>{formatSeconds(summaryElapsed)}</Text>
                </View>
              </View>
              <Text style={styles.progressNote}>
                Puoi uscire da questa schermata. Il riassunto continua sul server.
              </Text>
            </View>
          )}

          {recording.summary && (
            <View style={[styles.transcriptCard, { marginTop: 16 }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionLabel}>Riassunto</Text>
                <TouchableOpacity
                  onPress={() => exportText(recording.summary!, 'summary', 'md')}
                  hitSlop={8}
                >
                  <Ionicons name="share-outline" size={20} color={Colors.accent} />
                </TouchableOpacity>
              </View>
              <View style={styles.transcriptScrollBox}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  persistentScrollbar
                >
                  <Text style={styles.transcriptText} selectable>{recording.summary}</Text>
                </ScrollView>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={17} color="#DC2626" />
            <Text style={styles.deleteButtonText}>Elimina registrazione</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function estimateAudioSeconds(sizeBytes: number | null, durationSeconds: number): number | null {
  if (durationSeconds && durationSeconds > 0) return durationSeconds;
  if (!sizeBytes) return null;
  // Heuristic for m4a/aac ~96 kbps ≈ 12 kB/s → seconds = bytes / 12000
  // Use a slightly conservative ratio.
  return Math.floor(sizeBytes / 12000);
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function AudioPlayerBar({
  isLoading,
  isPlaying,
  position,
  duration,
  onTogglePlay,
  onSeek,
}: {
  isLoading: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number, andPlay?: boolean) => void;
}) {
  const [barWidth, setBarWidth] = useState(0);
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <View style={styles.playerCard}>
      <TouchableOpacity onPress={onTogglePlay} style={styles.playButton} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={Colors.white} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          style={styles.playerBarTrack}
          onStartShouldSetResponder={() => duration > 0}
          onResponderRelease={(e) => {
            if (duration <= 0 || barWidth <= 0) return;
            const x = Math.max(0, Math.min(barWidth, e.nativeEvent.locationX));
            const seekSec = (x / barWidth) * (duration / 1000);
            onSeek(seekSec, isPlaying);
          }}
        >
          <View style={[styles.playerBarFill, { width: `${pct * 100}%` }]} />
          <View style={[styles.playerBarKnob, { left: Math.max(0, pct * barWidth - 6) }]} />
        </View>
        <View style={styles.playerTimeRow}>
          <Text style={styles.playerTimeText}>{formatMs(position)}</Text>
          <Text style={styles.playerTimeText}>{formatMs(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

function TappableTranscript({
  segments,
  currentIdx,
  highlight,
  onWordPress,
}: {
  segments: TranscriptSegment[];
  currentIdx: number;
  highlight: string | null;
  onWordPress: (start: number) => void;
}) {
  const lcq = highlight ? highlight.toLowerCase() : null;
  return (
    <Text style={styles.transcriptText}>
      {segments.map((seg, i) => {
        const isCurrent = i === currentIdx;
        const isMatch = lcq ? seg.text.toLowerCase().includes(lcq) : false;
        return (
          <Text
            key={i}
            onPress={() => onWordPress(seg.start)}
            style={[
              isCurrent && styles.wordCurrent,
              isMatch && styles.highlightMatch,
            ]}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

function AudioInfoCard({
  sizeBytes,
  durationSeconds,
}: {
  sizeBytes: number | null;
  durationSeconds: number;
}) {
  const audioSec = estimateAudioSeconds(sizeBytes, durationSeconds);
  const etaSec = audioSec ? Math.max(15, Math.round(audioSec / 8) + 10) : null;
  const sizeMb = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
  const audioMmss = audioSec ? formatSeconds(audioSec) : null;

  if (!sizeMb && !audioMmss && !etaSec) return null;

  return (
    <View style={[styles.progressCard, { marginBottom: 12 }]}>
      <View style={styles.progressMeta}>
        {sizeMb && (
          <View style={styles.progressMetaItem}>
            <Text style={styles.progressMetaLabel}>File</Text>
            <Text style={styles.progressMetaValue}>{sizeMb} MB</Text>
          </View>
        )}
        {audioMmss && (
          <View style={styles.progressMetaItem}>
            <Text style={styles.progressMetaLabel}>Durata audio</Text>
            <Text style={styles.progressMetaValue}>{audioMmss}</Text>
          </View>
        )}
        {etaSec && (
          <View style={styles.progressMetaItem}>
            <Text style={styles.progressMetaLabel}>Tempo stimato</Text>
            <Text style={styles.progressMetaValue}>~{formatSeconds(etaSec)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TranscribeProgressCard({
  elapsed,
  sizeBytes,
  durationSeconds,
}: {
  elapsed: number;
  sizeBytes: number | null;
  durationSeconds: number;
}) {
  const audioSec = estimateAudioSeconds(sizeBytes, durationSeconds);
  // Scribe processa ~10x realtime; aggiungiamo overhead network/upload.
  const etaSec = audioSec ? Math.max(15, Math.round(audioSec / 8) + 10) : null;
  const remaining = etaSec ? Math.max(0, etaSec - elapsed) : null;
  const pct = etaSec ? Math.min(99, Math.round((elapsed / etaSec) * 100)) : null;
  const sizeMb = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
  const audioMmss = audioSec ? formatSeconds(audioSec) : null;

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <ActivityIndicator color={Colors.accent} size="small" />
        <Text style={styles.progressTitle}>Trascrizione in corso</Text>
      </View>

      <View style={styles.progressMeta}>
        <View style={styles.progressMetaItem}>
          <Text style={styles.progressMetaLabel}>Trascorsi</Text>
          <Text style={styles.progressMetaValue}>{formatSeconds(elapsed)}</Text>
        </View>
        {remaining !== null && (
          <View style={styles.progressMetaItem}>
            <Text style={styles.progressMetaLabel}>Stimato</Text>
            <Text style={styles.progressMetaValue}>~{formatSeconds(remaining)}</Text>
          </View>
        )}
        {sizeMb && (
          <View style={styles.progressMetaItem}>
            <Text style={styles.progressMetaLabel}>File</Text>
            <Text style={styles.progressMetaValue}>{sizeMb} MB</Text>
          </View>
        )}
        {audioMmss && (
          <View style={styles.progressMetaItem}>
            <Text style={styles.progressMetaLabel}>Durata audio</Text>
            <Text style={styles.progressMetaValue}>{audioMmss}</Text>
          </View>
        )}
      </View>

      {pct !== null && (
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
      )}

      <Text style={styles.progressNote}>
        Puoi uscire da questa schermata. La trascrizione continua sul server e troverai il risultato qui.
      </Text>
    </View>
  );
}

function HighlightedText({
  text,
  query,
  style,
}: {
  text: string;
  query: string | null;
  style: object;
}) {
  if (!query) return <Text style={style} selectable>{text}</Text>;
  const lcq = query.toLowerCase();
  const lc = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lc.indexOf(lcq, cursor);
  let key = 0;
  while (idx >= 0) {
    if (idx > cursor) parts.push(<Text key={key++}>{text.slice(cursor, idx)}</Text>);
    parts.push(
      <Text key={key++} style={styles.highlightMatch}>
        {text.slice(idx, idx + query.length)}
      </Text>
    );
    cursor = idx + query.length;
    idx = lc.indexOf(lcq, cursor);
  }
  if (cursor < text.length) parts.push(<Text key={key++}>{text.slice(cursor)}</Text>);
  return <Text style={style} selectable>{parts}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: Colors.secondary, fontSize: 16 },
  topBar: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  backText: { fontSize: 18, color: Colors.accent },
  scroll: { padding: 18, paddingBottom: 60 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { ...Fonts.title, color: Colors.label, flex: 1 },
  titleEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  titleInput: {
    ...Fonts.title, color: Colors.label, flex: 1,
    backgroundColor: Colors.card, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.sep,
  },
  meta: { fontSize: 16, color: Colors.secondary, marginBottom: 18 },
  statusCard: { backgroundColor: Colors.card, borderRadius: 13, padding: 13, marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 16, color: Colors.label, fontWeight: '500' },
  actionButton: {
    backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 18,
  },
  actionButtonText: { color: Colors.white, fontSize: 18, fontWeight: '600' },
  summaryButton: { marginTop: 16, marginBottom: 0 },
  progressCard: {
    backgroundColor: Colors.card, borderRadius: 13, padding: 16,
    marginBottom: 18, gap: 14,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTitle: { fontSize: 17, fontWeight: '600', color: Colors.label },
  progressMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  progressMetaItem: { gap: 2 },
  progressMetaLabel: {
    fontSize: 12, color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: '500',
  },
  progressMetaValue: {
    fontSize: 18, color: Colors.label, fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  progressNote: { fontSize: 13, color: Colors.tertiary, lineHeight: 18, fontStyle: 'italic' },
  transcriptCard: { backgroundColor: Colors.card, borderRadius: 13, padding: 14 },
  transcriptHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14, color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  transcriptText: { fontSize: 17, color: Colors.label, lineHeight: 24 },
  transcriptScrollBox: { maxHeight: 360 },
  highlightMatch: { backgroundColor: '#FEF3C7', fontWeight: '600' },
  wordCurrent: { backgroundColor: Colors.accent, color: Colors.white, borderRadius: 3 },
  editLink: { fontSize: 15, color: Colors.accent, fontWeight: '500' },
  cardHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  playerCard: {
    backgroundColor: Colors.card, borderRadius: 13, padding: 14,
    marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  playButton: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  playerBarTrack: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, position: 'relative',
    justifyContent: 'center',
  },
  playerBarFill: {
    height: 6, backgroundColor: Colors.accent, borderRadius: 3,
  },
  playerBarKnob: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.accent, top: -3,
  },
  playerTimeRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  playerTimeText: { fontSize: 13, color: Colors.secondary, fontVariant: ['tabular-nums'] },
  transcriptInput: {
    fontSize: 17, color: Colors.label, lineHeight: 24,
    minHeight: 200, padding: 0, paddingTop: 0,
  },
  editActions: {
    flexDirection: 'row', gap: 10, marginTop: 14,
  },
  cancelButton: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.sep,
  },
  cancelButtonText: { color: Colors.label, fontSize: 16, fontWeight: '500' },
  saveButton: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  saveButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 13,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: '#FECACA',
    marginTop: 24,
  },
  deleteButtonText: { color: '#DC2626', fontSize: 17, fontWeight: '600' },
});

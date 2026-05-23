import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../src/theme';
import { getAllRecordings } from '../src/stores/recordingStore';
import { loadDanglingSession, clearSession } from '../src/stores/recordingSession';
import { processQueue, subscribeToUploadQueue } from '../src/services/uploadQueue';
import { deleteRecordingFully } from '../src/services/deleteRecording';
import { reconcileServerIds } from '../src/services/syncWithServer';
import { fetchElevenLabsUsage, fetchRailwayUsage } from '../src/services/api';
import { searchRecordings, SearchMatch } from '../src/services/search';
import RecordingRow from '../src/components/RecordingRow';
import type { Recording } from '../src/types';

const USAGE_WARNING_THRESHOLD = 0.8;

export default function HomeScreen() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [usageWarning, setUsageWarning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let cancelled = false;

      const runSync = async () => {
        if (cancelled) return;
        const touched = await reconcileServerIds().catch(() => 0);
        if (touched > 0) await loadRecordings();
      };

      (async () => {
        await loadRecordings();
        checkDanglingSession();
        processQueue().catch(console.log);
        await runSync();
        checkUsageWarning();

        // Poll every 4s if any recording is transcribing or summarizing.
        const all = await getAllRecordings();
        const inProgress = all.some(
          (r) => r.status === 'transcribing' || (r.summarizationStartedAt && !r.summary)
        );
        if (inProgress) {
          pollTimer = setInterval(runSync, 4000);
        }
      })();

      return () => {
        cancelled = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }, [])
  );

  async function checkUsageWarning() {
    try {
      const [eleven, railway] = await Promise.allSettled([
        fetchElevenLabsUsage(),
        fetchRailwayUsage(),
      ]);
      let warning = false;
      if (eleven.status === 'fulfilled') {
        const { characterCount, characterLimit } = eleven.value;
        if (characterLimit > 0 && characterCount / characterLimit > USAGE_WARNING_THRESHOLD) {
          warning = true;
        }
      }
      if (railway.status === 'fulfilled') {
        const { currentUsageUsd, includedUsd } = railway.value;
        if (
          typeof currentUsageUsd === 'number' &&
          typeof includedUsd === 'number' &&
          includedUsd > 0 &&
          currentUsageUsd / includedUsd > USAGE_WARNING_THRESHOLD
        ) {
          warning = true;
        }
      }
      setUsageWarning(warning);
    } catch {
      // ignore - warning stays as-is
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeToUploadQueue(() => loadRecordings());
    return unsubscribe;
  }, []);

  async function loadRecordings() {
    const all = await getAllRecordings();
    setRecordings(all);
  }

  function confirmDelete(item: Recording) {
    Alert.alert(
      'Elimina registrazione',
      `Sei sicuro di voler eliminare "${item.title}"? Questa azione non può essere annullata.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecordingFully(item);
              await loadRecordings();
            } catch (err) {
              Alert.alert('Errore', `Impossibile eliminare: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
            }
          },
        },
      ]
    );
  }

  async function checkDanglingSession() {
    const session = await loadDanglingSession();
    if (!session || !session.audioUri) return;

    Alert.alert(
      'Registrazione interrotta',
      `È stata trovata una registrazione non completata ("${session.provisionalTitle}", ${formatElapsed(session.elapsedSeconds)}). Vuoi recuperarla?`,
      [
        {
          text: 'Scarta',
          style: 'destructive',
          onPress: () => clearSession(),
        },
        {
          text: 'Recupera e salva',
          onPress: () => {
            router.push({
              pathname: '/save',
              params: {
                audioUri: session.audioUri!,
                duration: String(session.elapsedSeconds),
                title: session.provisionalTitle,
                subject: session.subject ?? '',
                bookmarks: JSON.stringify(session.bookmarks),
                recordedAt: session.startedAt,
              },
            });
          },
        },
      ]
    );
  }

  const searchResults: SearchMatch[] = searchQuery.trim()
    ? searchRecordings(recordings, searchQuery)
    : [];
  const filtered = searchQuery.trim()
    ? searchResults.map((m) => m.recording)
    : recordings;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recy</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.5}
            hitSlop={6}
          >
            <Ionicons name="stats-chart" size={22} color={Colors.accent} />
            {usageWarning && <View style={styles.warningDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/import')}
            activeOpacity={0.5}
            hitSlop={6}
          >
            <Ionicons name="add" size={32} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color={Colors.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca"
            placeholderTextColor={Colors.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mic-outline" size={48} color={Colors.tertiary} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'Nessun risultato' : 'Nessuna registrazione'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Prova con un altro termine'
              : 'Premi il pulsante in basso\nper iniziare a registrare'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const match = searchResults.find((m) => m.recording.id === item.id);
            const target = match && match.field === 'transcript'
              ? `/recording/${item.id}?q=${encodeURIComponent(searchQuery.trim())}`
              : `/recording/${item.id}`;
            return (
              <RecordingRow
                recording={item}
                isLast={index === filtered.length - 1}
                onPress={() => router.push(target)}
                onLongPress={() => confirmDelete(item)}
                snippet={match?.field === 'transcript' ? match.snippet : undefined}
                snippetQuery={match?.field === 'transcript' ? searchQuery.trim() : undefined}
              />
            );
          }}
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>
              {searchQuery ? `${filtered.length} risultati` : 'Recenti'}
            </Text>
          }
        />
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.recordButton}
          onPress={() => router.push('/record?autostart=true')}
          hitSlop={10}
        >
          <View style={styles.recordButtonInner} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', gap: 4, marginRight: -8 },
  warningDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Fonts.title,
    fontSize: 36,
    color: Colors.label,
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8E8EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 19,
    color: Colors.label,
    padding: 0,
  },
  sectionHeader: {
    fontSize: 16,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingBottom: 6,
    paddingTop: 2,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 110,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: Colors.label,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 18,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 56,
    paddingTop: 22,
    alignItems: 'center',
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.card,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  recordButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.red,
  },
});

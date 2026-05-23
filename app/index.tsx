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
import RecordingRow from '../src/components/RecordingRow';
import type { Recording } from '../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadRecordings();
      checkDanglingSession();
      processQueue().catch(console.log);
    }, [])
  );

  useEffect(() => {
    const unsubscribe = subscribeToUploadQueue(() => loadRecordings());
    return unsubscribe;
  }, []);

  async function loadRecordings() {
    const all = await getAllRecordings();
    setRecordings(all);
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

  const filtered = searchQuery.trim()
    ? recordings.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : recordings;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recy</Text>
        <TouchableOpacity
          style={styles.importButton}
          onPress={() => router.push('/import')}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.accent} />
        </TouchableOpacity>
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
              : 'Registra la tua prima lezione\ncon il pulsante qui sotto'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <RecordingRow
              recording={item}
              isLast={index === filtered.length - 1}
              onPress={() => {}}
            />
          )}
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>
              {searchQuery ? `${filtered.length} risultati` : 'Recenti'}
            </Text>
          }
        />
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.recordButton}
          onPress={() => router.push('/record')}
        >
          <Ionicons name="mic" size={18} color={Colors.white} />
          <Text style={styles.recordButtonText}>Nuova registrazione</Text>
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
  importButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.sep,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  headerTitle: {
    ...Fonts.title,
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
    fontSize: 15,
    color: Colors.label,
    padding: 0,
  },
  sectionHeader: {
    fontSize: 12,
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
    fontSize: 17,
    fontWeight: '600',
    color: Colors.label,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 34,
    paddingTop: 22,
  },
  recordButton: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  recordButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

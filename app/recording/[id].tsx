import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../src/theme';
import { getAllRecordings, updateRecording } from '../../src/stores/recordingStore';
import { transcribeRecording } from '../../src/services/api';
import { deleteRecordingFully } from '../../src/services/deleteRecording';
import type { Recording } from '../../src/types';

export default function RecordingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const load = useCallback(async () => {
    const all = await getAllRecordings();
    const found = all.find((r) => r.id === id);
    setRecording(found ?? null);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  async function handleTranscribe() {
    if (!recording?.serverId) {
      Alert.alert('Impossibile trascrivere', 'La registrazione non è stata ancora caricata sul cloud.');
      return;
    }
    setTranscribing(true);
    try {
      const result = await transcribeRecording(recording.serverId);
      await updateRecording(recording.id, {
        status: 'transcribed',
        syncState: 'transcribed',
        transcript: result.transcriptVerbatim,
      });
      await load();
    } catch (err) {
      console.error('Transcribe error', err);
      Alert.alert('Errore', `Trascrizione fallita: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
    } finally {
      setTranscribing(false);
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

  const canTranscribe = recording.syncState === 'uploaded' && !recording.transcript;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
          <Text style={styles.backText}>Recy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{recording.title}</Text>
        <Text style={styles.meta}>
          {recording.subject ? `${recording.subject} · ` : ''}
          {formatDuration(recording.durationSeconds)}
        </Text>

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

        {canTranscribe && (
          <TouchableOpacity
            style={[styles.actionButton, transcribing && { opacity: 0.6 }]}
            onPress={handleTranscribe}
            disabled={transcribing}
            activeOpacity={0.8}
          >
            {transcribing ? (
              <>
                <ActivityIndicator color={Colors.white} size="small" />
                <Text style={styles.actionButtonText}>Trascrizione in corso…</Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color={Colors.white} />
                <Text style={styles.actionButtonText}>Trascrivi</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {recording.transcript && (
          <View style={styles.transcriptCard}>
            <Text style={styles.sectionLabel}>Trascrizione</Text>
            <Text style={styles.transcriptText}>{recording.transcript}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: Colors.secondary, fontSize: 16 },
  topBar: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  backText: { fontSize: 18, color: Colors.accent },
  scroll: { padding: 18 },
  title: { ...Fonts.title, color: Colors.label, marginBottom: 6 },
  meta: { fontSize: 16, color: Colors.secondary, marginBottom: 18 },
  statusCard: {
    backgroundColor: Colors.card, borderRadius: 13, padding: 13,
    marginBottom: 16,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 16, color: Colors.label, fontWeight: '500' },
  actionButton: {
    backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 18,
  },
  actionButtonText: { color: Colors.white, fontSize: 18, fontWeight: '600' },
  transcriptCard: {
    backgroundColor: Colors.card, borderRadius: 13, padding: 14,
  },
  sectionLabel: {
    fontSize: 14, color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: '500', marginBottom: 8,
  },
  transcriptText: { fontSize: 17, color: Colors.label, lineHeight: 22 },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 13,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: '#FECACA',
    marginTop: 24,
  },
  deleteButtonText: { color: '#DC2626', fontSize: 17, fontWeight: '600' },
});

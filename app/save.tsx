import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../src/theme';
import { saveRecording, createRecordingFromSession } from '../src/stores/recordingStore';
import { clearSession } from '../src/stores/recordingSession';
import { enqueueUpload } from '../src/services/uploadQueue';
import type { Bookmark } from '../src/types';

function defaultTitleFromDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}-`;
}

export default function SaveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    audioUri: string;
    duration: string;
    title: string;
    subject: string;
    bookmarks: string;
    recordedAt: string;
  }>();

  const recordedAt = params.recordedAt ?? new Date().toISOString();
  const initialTitle = params.title?.trim() || defaultTitleFromDate(recordedAt);

  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);

  const duration = parseInt(params.duration ?? '0', 10);
  const bookmarks: Bookmark[] = params.bookmarks ? JSON.parse(params.bookmarks) : [];

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function handleSave() {
    if (!params.audioUri) {
      Alert.alert('Errore', 'Nessun file audio trovato.');
      return;
    }

    setSaving(true);

    try {
      const recording = createRecordingFromSession({
        title: title.trim() || defaultTitleFromDate(recordedAt),
        subject: null,
        audioUri: params.audioUri,
        durationSeconds: duration,
        bookmarks,
        recordedAt,
      });

      await saveRecording(recording);
      await clearSession();
      enqueueUpload(recording).catch(console.log);

      router.replace('/');
    } catch (err) {
      Alert.alert('Errore', 'Impossibile salvare la registrazione.');
      console.error('Save error:', err);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.accent} />
            </View>
            <Text style={styles.headerTitle}>Salva registrazione</Text>
            <Text style={styles.headerSubtitle}>
              {formatDuration(duration)} registrati · {bookmarks.length} segnalibr{bookmarks.length === 1 ? 'o' : 'i'}
            </Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Titolo</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Nome della registrazione"
              placeholderTextColor={Colors.tertiary}
              autoFocus
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Salvataggio…' : 'Salva registrazione'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 18, paddingTop: 24 },
  header: { alignItems: 'center', marginBottom: 28, gap: 6 },
  successIcon: { marginBottom: 4 },
  headerTitle: { ...Fonts.heading, color: Colors.label },
  headerSubtitle: { fontSize: 16, color: Colors.secondary },
  fieldContainer: { marginBottom: 20 },
  fieldLabel: { fontSize: 14.5, color: Colors.secondary, fontWeight: '500', marginBottom: 6, paddingLeft: 2 },
  textInput: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.sep,
    borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 18, color: Colors.label,
  },
  saveButton: {
    backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 13,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  saveButtonText: { color: Colors.white, fontSize: 18, fontWeight: '600' },
});

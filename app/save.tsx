import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../src/theme';
import { saveLesson, createLessonFromRecording } from '../src/stores/lessonStore';
import { clearSession } from '../src/stores/recordingSession';
import { enqueueUpload } from '../src/services/uploadQueue';
import type { Bookmark } from '../src/types';

const SUBJECTS = ['Diritto', 'Matematica', 'Storia', 'Fisica', 'Filosofia', 'Informatica'];

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

  const [title, setTitle] = useState(params.title ?? 'Registrazione');
  const [subject, setSubject] = useState<string | null>(
    params.subject && params.subject.length > 0 ? params.subject : null
  );
  const [customSubject, setCustomSubject] = useState('');
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
      const finalSubject = subject === '__custom__' ? customSubject.trim() || null : subject;

      const lesson = createLessonFromRecording({
        title: title.trim() || 'Registrazione',
        subject: finalSubject,
        audioUri: params.audioUri,
        durationSeconds: duration,
        bookmarks,
        recordedAt: params.recordedAt ?? new Date().toISOString(),
      });

      await saveLesson(lesson);
      await clearSession();
      enqueueUpload(lesson).catch(console.log);

      router.replace('/');
    } catch (err) {
      Alert.alert('Errore', 'Impossibile salvare la lezione.');
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.accent} />
            </View>
            <Text style={styles.headerTitle}>Salva lezione</Text>
            <Text style={styles.headerSubtitle}>
              {formatDuration(duration)} registrati · {bookmarks.length} segnalibr{bookmarks.length === 1 ? 'o' : 'i'}
            </Text>
          </View>

          {/* Title field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Titolo</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Nome della lezione"
              placeholderTextColor={Colors.tertiary}
              autoFocus
              returnKeyType="done"
              selectTextOnFocus
            />
          </View>

          {/* Subject field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Materia</Text>
            <View style={styles.subjectGrid}>
              <TouchableOpacity
                style={[
                  styles.subjectChip,
                  !subject && styles.subjectChipActive,
                ]}
                onPress={() => setSubject(null)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.subjectChipText,
                    !subject && styles.subjectChipTextActive,
                  ]}
                >
                  Nessuna
                </Text>
              </TouchableOpacity>

              {SUBJECTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.subjectChip,
                    subject === s && styles.subjectChipActive,
                  ]}
                  onPress={() => setSubject(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.subjectChipText,
                      subject === s && styles.subjectChipTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.subjectChip,
                  subject === '__custom__' && styles.subjectChipActive,
                ]}
                onPress={() => setSubject('__custom__')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.subjectChipText,
                    subject === '__custom__' && styles.subjectChipTextActive,
                  ]}
                >
                  Altra…
                </Text>
              </TouchableOpacity>
            </View>

            {subject === '__custom__' && (
              <TextInput
                style={[styles.textInput, { marginTop: 10 }]}
                value={customSubject}
                onChangeText={setCustomSubject}
                placeholder="Nome della materia"
                placeholderTextColor={Colors.tertiary}
                returnKeyType="done"
              />
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Salvataggio…' : 'Salva lezione'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    padding: 18,
    paddingTop: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 6,
  },
  successIcon: {
    marginBottom: 4,
  },
  headerTitle: {
    ...Fonts.heading,
    color: Colors.label,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.secondary,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12.5,
    color: Colors.secondary,
    fontWeight: '500',
    marginBottom: 6,
    paddingLeft: 2,
  },
  textInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.sep,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.label,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.sep,
  },
  subjectChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.label,
  },
  subjectChipTextActive: {
    color: Colors.white,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

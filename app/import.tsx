import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet,
  SafeAreaView, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Fonts } from '../src/theme';
import { saveRecording } from '../src/stores/recordingStore';
import { enqueueUpload } from '../src/services/uploadQueue';
import type { Recording } from '../src/types';

const ACCEPTED_TYPES = [
  'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/opus', 'audio/webm', 'audio/flac', 'audio/aac',
  'video/mp4', 'video/quicktime', 'video/webm',
];

const SUBJECTS = ['Diritto', 'Matematica', 'Storia', 'Fisica', 'Filosofia', 'Informatica'];

interface PickedFile {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
}

export default function ImportScreen() {
  const router = useRouter();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [customSubject, setCustomSubject] = useState('');
  const [saving, setSaving] = useState(false);

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_TYPES, 'audio/*', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      const MAX_SIZE = 3 * 1024 * 1024 * 1024;
      if (asset.size && asset.size > MAX_SIZE) {
        Alert.alert('File troppo grande', 'Il limite massimo è 3 GB.');
        return;
      }

      setFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
      });

      const nameWithoutExt = asset.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(nameWithoutExt);
    } catch (err) {
      Alert.alert('Errore', 'Impossibile selezionare il file.');
      console.error('Document picker error:', err);
    }
  }

  async function handleImport() {
    if (!file) return;
    setSaving(true);

    try {
      const finalSubject = subject === '__custom__' ? customSubject.trim() || null : subject;
      const now = new Date().toISOString();

      const recording: Recording = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim() || file.name,
        subject: finalSubject,
        recordedAt: now,
        durationSeconds: 0,
        audioUri: file.uri,
        source: 'import',
        bookmarks: [],
        status: 'recorded',
        syncState: 'local_only',
        createdAt: now,
        updatedAt: now,
      };

      await saveRecording(recording);
      enqueueUpload(recording).catch(console.log);

      router.replace('/');
    } catch (err) {
      Alert.alert('Errore', 'Impossibile importare il file.');
      console.error('Import error:', err);
      setSaving(false);
    }
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

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
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Importa</Text>
          <Text style={styles.subtitle}>
            Aggiungi un file audio o video già registrato.{'\n'}Verrà trascritto come una normale registrazione.
          </Text>

          {!file ? (
            <>
              <TouchableOpacity
                style={styles.pickButton}
                onPress={pickFile}
                activeOpacity={0.7}
              >
                <View style={styles.pickIconCircle}>
                  <Ionicons name="cloud-upload-outline" size={24} color={Colors.label} />
                </View>
                <Text style={styles.pickTitle}>Scegli un file</Text>
                <Text style={styles.pickSubtitle}>da File, iCloud o altre app</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>Oppure condividi verso l'app</Text>
              <View style={styles.hintCard}>
                <Ionicons name="document-outline" size={19} color={Colors.secondary} />
                <Text style={styles.hintText}>
                  Da Memo Vocali, WhatsApp, Mail… usa "Condividi" e scegli questa app.
                </Text>
              </View>

              <Text style={styles.formatsText}>
                Formati: m4a, mp3, wav, opus, flac… e video (mp4, mov)
              </Text>
            </>
          ) : (
            <>
              <View style={styles.fileCard}>
                <View style={styles.fileIconCircle}>
                  <Ionicons name="document-outline" size={19} color={Colors.label} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileMeta}>{formatSize(file.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => setFile(null)}>
                  <Ionicons name="close-circle" size={22} color={Colors.tertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Titolo</Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Nome della registrazione"
                  placeholderTextColor={Colors.tertiary}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Materia</Text>
                <View style={styles.subjectGrid}>
                  <TouchableOpacity
                    style={[styles.chip, !subject && styles.chipActive]}
                    onPress={() => setSubject(null)}
                  >
                    <Text style={[styles.chipText, !subject && styles.chipTextActive]}>
                      Nessuna
                    </Text>
                  </TouchableOpacity>
                  {SUBJECTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, subject === s && styles.chipActive]}
                      onPress={() => setSubject(s)}
                    >
                      <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.chip, subject === '__custom__' && styles.chipActive]}
                    onPress={() => setSubject('__custom__')}
                  >
                    <Text style={[styles.chipText, subject === '__custom__' && styles.chipTextActive]}>
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

              <TouchableOpacity
                style={[styles.importButton, saving && { opacity: 0.6 }]}
                onPress={handleImport}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.importButtonText}>
                  {saving ? 'Importazione…' : 'Importa e trascrivi'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  backText: { fontSize: 16, color: Colors.accent },
  scroll: { padding: 18 },
  title: { ...Fonts.title, color: Colors.label, marginBottom: 4 },
  subtitle: { fontSize: 14.5, color: Colors.secondary, lineHeight: 20, marginBottom: 18 },
  pickButton: {
    width: '100%', borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.tertiary,
    backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 30, paddingHorizontal: 16, alignItems: 'center', gap: 10,
  },
  pickIconCircle: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  pickTitle: { fontSize: 16, fontWeight: '600', color: Colors.label },
  pickSubtitle: { fontSize: 13, color: Colors.secondary },
  sectionLabel: {
    fontSize: 12, color: Colors.secondary, textTransform: 'uppercase', letterSpacing: 0.3,
    fontWeight: '500', marginTop: 22, marginBottom: 8, paddingLeft: 6,
  },
  hintCard: { backgroundColor: Colors.card, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  hintText: { fontSize: 14, color: Colors.secondary, lineHeight: 19, flex: 1 },
  formatsText: { fontSize: 12, color: Colors.tertiary, textAlign: 'center', marginTop: 16 },
  fileCard: { backgroundColor: Colors.card, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  fileIconCircle: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 15, fontWeight: '600', color: Colors.label },
  fileMeta: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  fieldContainer: { marginBottom: 20 },
  fieldLabel: { fontSize: 12.5, color: Colors.secondary, fontWeight: '500', marginBottom: 6, paddingLeft: 2 },
  textInput: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.sep,
    borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, color: Colors.label,
  },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.sep },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontSize: 14, fontWeight: '500', color: Colors.label },
  chipTextActive: { color: Colors.white },
  importButton: {
    backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 13, alignItems: 'center', marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  importButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});

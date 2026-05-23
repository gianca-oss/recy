import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet,
  SafeAreaView, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Battery from 'expo-battery';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../src/theme';

async function haptic(style: 'light' | 'medium' | 'success') {
  try {
    if (style === 'success') {
      await haptic('success');
    } else if (style === 'medium') {
      await haptic('medium');
    } else {
      await haptic('light');
    }
  } catch (e) {
    console.log('Haptics error:', e);
  }
}
import {
  createNewSession, persistSession, clearSession,
  addBookmarkToSession,
} from '../src/stores/recordingSession';
import type { RecordingSessionState } from '../src/types';
import AudioWaveform from '../src/components/AudioWaveform';

type RecState = 'idle' | 'recording' | 'paused';

export default function RecordScreen() {
  const router = useRouter();

  const [recState, setRecState] = useState<RecState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [session, setSession] = useState<RecordingSessionState>(createNewSession());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [metering, setMetering] = useState(-60);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const sessionRef = useRef(session);
  const recStateRef = useRef(recState);
  const meteringInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { recStateRef.current = recState; }, [recState]);

  useEffect(() => {
    if (recState !== 'idle') {
      const updated = { ...session, elapsedSeconds, isPaused: recState === 'paused' };
      persistSession(updated);
    }
  }, [recState, elapsedSeconds, session.bookmarks.length]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (recStateRef.current !== 'idle') {
          const updated = {
            ...sessionRef.current,
            elapsedSeconds: elapsedRef.current,
            isPaused: recStateRef.current === 'paused',
          };
          persistSession(updated);
        }
      }
    });
    return () => sub.remove();
  }, []);

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startMeteringPolling() {
    stopMeteringPolling();
    meteringInterval.current = setInterval(async () => {
      if (recordingRef.current && recStateRef.current === 'recording') {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            setMetering(status.metering);
          }
        } catch {}
      }
    }, 100);
  }

  function stopMeteringPolling() {
    if (meteringInterval.current) {
      clearInterval(meteringInterval.current);
      meteringInterval.current = null;
    }
  }

  useEffect(() => () => { stopTimer(); stopMeteringPolling(); }, []);

  async function handleStart() {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Permesso microfono necessario',
        'Per registrare le lezioni, consenti l\'accesso al microfono nelle Impostazioni del dispositivo.',
        [{ text: 'OK' }]
      );
      return;
    }

    const batteryLevel = await Battery.getBatteryLevelAsync();
    if (batteryLevel >= 0 && batteryLevel < 0.1) {
      Alert.alert(
        'Batteria scarica',
        `La batteria è al ${Math.round(batteryLevel * 100)}%. La registrazione potrebbe interrompersi. Vuoi continuare?`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Registra comunque', onPress: () => startRecording() },
        ]
      );
      return;
    }

    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const MIN_SPACE = 100 * 1024 * 1024;
      if (freeSpace < MIN_SPACE) {
        Alert.alert(
          'Spazio insufficiente',
          'Lo spazio disponibile sul dispositivo è molto limitato. Libera spazio prima di registrare.',
        );
        return;
      }
    } catch {
      // Not available in Expo Go — skip check
    }

    await startRecording();
  }

  async function startRecording() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await recording.startAsync();

      recordingRef.current = recording;

      const uri = recording.getURI();
      const newSession = createNewSession();
      newSession.audioUri = uri;
      setSession(newSession);
      setRecState('recording');
      startTimer();
      startMeteringPolling();

      haptic('medium');
    } catch (err) {
      Alert.alert('Errore', 'Impossibile avviare la registrazione. Riprova.');
      console.error('Recording start error:', err);
    }
  }

  async function handlePause() {
    try {
      if (recordingRef.current) {
        await recordingRef.current.pauseAsync();
      }
      setRecState('paused');
      stopTimer();
      stopMeteringPolling();
      setMetering(-60);
      haptic('light');
    } catch (err) {
      console.error('Pause error:', err);
    }
  }

  async function handleResume() {
    try {
      if (recordingRef.current) {
        await recordingRef.current.startAsync();
      }
      setRecState('recording');
      startTimer();
      startMeteringPolling();
      haptic('light');
    } catch (err) {
      console.error('Resume error:', err);
    }
  }

  function handlePauseToggle() {
    if (recState === 'recording') handlePause();
    else if (recState === 'paused') handleResume();
  }

  function handleStopRequest() {
    setShowStopConfirm(true);
    haptic('medium');
  }

  async function handleStopConfirm() {
    setShowStopConfirm(false);
    stopTimer();
    stopMeteringPolling();

    try {
      if (!recordingRef.current) {
        Alert.alert('Errore', 'Nessuna registrazione attiva.');
        return;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const audioUri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!audioUri) {
        Alert.alert('Errore', 'Nessun file audio trovato.');
        return;
      }

      setRecState('idle');

      router.replace({
        pathname: '/save',
        params: {
          audioUri,
          duration: String(elapsedRef.current),
          title: session.provisionalTitle,
          subject: session.subject ?? '',
          bookmarks: JSON.stringify(session.bookmarks),
          recordedAt: session.startedAt,
        },
      });
    } catch (err) {
      Alert.alert('Errore', 'Problema nel terminare la registrazione.');
      console.error('Recording stop error:', err);
    }
  }

  function handleBookmark() {
    const updated = addBookmarkToSession(session, elapsedRef.current);
    setSession(updated);
    haptic('success');
  }

  function handleBack() {
    if (recState !== 'idle') {
      Alert.alert(
        'Registrazione in corso',
        'Devi terminare la registrazione prima di uscire.',
      );
      return;
    }
    router.back();
  }

  const hh = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsedSeconds % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
          <Text style={styles.backText}>Recy</Text>
        </TouchableOpacity>

        {recState !== 'idle' && (
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: recState === 'recording' ? Colors.red : Colors.secondary },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: recState === 'recording' ? Colors.red : Colors.secondary },
              ]}
            >
              {recState === 'recording' ? 'Registrazione' : 'In pausa'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.center}>
        {recState === 'idle' ? (
          <View style={styles.idleContainer}>
            <View style={styles.idleMicCircle}>
              <Ionicons name="mic" size={40} color={Colors.accent} />
            </View>
            <Text style={styles.idleTitle}>Pronta per registrare</Text>
            <Text style={styles.idleSubtitle}>
              Premi il pulsante per iniziare{'\n'}la registrazione
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.subjectLabel}>{session.provisionalTitle}</Text>
            <Text style={styles.timer}>
              {hh}:{mm}
              <Text style={{ color: Colors.tertiary }}>:{ss}</Text>
            </Text>

            <AudioWaveform
              metering={metering}
              isActive={recState === 'recording'}
            />

            <View style={styles.bookmarkInfo}>
              <Ionicons name="bookmark" size={12} color={Colors.accent} />
              <Text style={styles.bookmarkText}>
                {session.bookmarks.length} segnalibr{session.bookmarks.length === 1 ? 'o' : 'i'}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.controls}>
        {recState === 'idle' ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.startButton}
            onPress={handleStart}
          >
            <Ionicons name="mic" size={30} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={handleBookmark}
              style={styles.controlItem}
              activeOpacity={0.7}
            >
              <View style={styles.smallButton}>
                <Ionicons name="bookmark-outline" size={20} color={Colors.accent} />
              </View>
              <Text style={styles.controlLabel}>Segna</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePauseToggle}
              style={styles.controlItem}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.mainButton,
                  { backgroundColor: recState === 'paused' ? Colors.accent : Colors.red },
                ]}
              >
                <Ionicons
                  name={recState === 'paused' ? 'play' : 'pause'}
                  size={28}
                  color={Colors.white}
                />
              </View>
              <Text style={styles.controlLabel}>
                {recState === 'paused' ? 'Riprendi' : 'Pausa'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStopRequest}
              style={styles.controlItem}
              activeOpacity={0.7}
            >
              <View style={styles.smallButton}>
                <Ionicons name="stop" size={18} color={Colors.red} />
              </View>
              <Text style={styles.controlLabel}>Termina</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showStopConfirm && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBg}
            activeOpacity={1}
            onPress={() => setShowStopConfirm(false)}
          />
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetTop}>
              <Text style={styles.actionSheetMessage}>
                Terminare la registrazione?{'\n'}
                L'audio verrà salvato.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionSheetDestructive}
              onPress={handleStopConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.actionSheetDestructiveText}>Termina e salva</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.actionSheetCancel}
            onPress={() => setShowStopConfirm(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionSheetCancelText}>Continua a registrare</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  backText: { fontSize: 16, color: Colors.accent },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: { fontSize: 13, fontWeight: '500' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 20,
  },
  idleContainer: {
    alignItems: 'center',
    gap: 12,
  },
  idleMicCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.label,
  },
  idleSubtitle: {
    fontSize: 15,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  subjectLabel: {
    fontSize: 14,
    color: Colors.secondary,
  },
  timer: {
    ...Fonts.timer,
    color: Colors.label,
    fontVariant: ['tabular-nums'],
  },
  bookmarkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  bookmarkText: {
    fontSize: 13,
    color: Colors.secondary,
  },
  controls: {
    paddingHorizontal: 26,
    paddingBottom: 40,
    alignItems: 'center',
  },
  startButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  controlItem: {
    alignItems: 'center',
    gap: 7,
  },
  smallButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.sep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mainButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  controlLabel: {
    fontSize: 11.5,
    color: Colors.secondary,
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 10,
    zIndex: 50,
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  actionSheet: {
    backgroundColor: 'rgba(249,249,250,0.96)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    zIndex: 51,
  },
  actionSheetTop: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.sep,
    alignItems: 'center',
  },
  actionSheetMessage: {
    fontSize: 13,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionSheetDestructive: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionSheetDestructiveText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.red,
  },
  actionSheetCancel: {
    backgroundColor: 'rgba(249,249,250,0.96)',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    zIndex: 51,
  },
  actionSheetCancelText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.accent,
  },
});

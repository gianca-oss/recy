import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../src/theme';
import {
  fetchUsageSummary, fetchElevenLabsUsage, fetchRailwayUsage,
} from '../src/services/api';

interface UsageSummary {
  recordings: { count: number };
  storage: { files: number; bytes: number };
}

interface ElevenLabsUsage {
  tier: string;
  characterCount: number;
  characterLimit: number;
  nextResetUnix: number | null;
  status: string;
}

interface RailwayUsage {
  periodStart: string;
  periodEnd: string;
  cpuHours: number | null;
  memoryGbHours: number | null;
  networkEgressGb: number | null;
  diskGb: number | null;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [eleven, setEleven] = useState<ElevenLabsUsage | null>(null);
  const [railway, setRailway] = useState<RailwayUsage | null>(null);
  const [errors, setErrors] = useState<{ eleven?: string; railway?: string; summary?: string }>({});

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const [s, e, r] = await Promise.allSettled([
      fetchUsageSummary(),
      fetchElevenLabsUsage(),
      fetchRailwayUsage(),
    ]);
    const newErrors: typeof errors = {};
    if (s.status === 'fulfilled') setSummary(s.value); else newErrors.summary = String(s.reason);
    if (e.status === 'fulfilled') setEleven(e.value); else newErrors.eleven = String(e.reason);
    if (r.status === 'fulfilled') setRailway(r.value); else newErrors.railway = String(r.reason);
    setErrors(newErrors);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
          <Text style={styles.backText}>Recy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} />}
      >
        <Text style={styles.title}>Consumi</Text>
        <Text style={styles.subtitle}>Trascina giù per aggiornare</Text>

        {/* ElevenLabs */}
        <Text style={styles.sectionLabel}>Trascrizioni · ElevenLabs</Text>
        <Card>
          {eleven ? (
            <ElevenLabsCard usage={eleven} />
          ) : errors.eleven ? (
            <ErrorRow message={errors.eleven} />
          ) : (
            <ActivityIndicator color={Colors.secondary} />
          )}
        </Card>

        {/* Railway */}
        <Text style={styles.sectionLabel}>Backend · Railway</Text>
        <Card>
          {railway ? (
            <RailwayCard usage={railway} />
          ) : errors.railway ? (
            <ErrorRow message={errors.railway} />
          ) : (
            <ActivityIndicator color={Colors.secondary} />
          )}
        </Card>

        {/* Storage + DB */}
        <Text style={styles.sectionLabel}>Archiviazione · S3 + Database</Text>
        <Card>
          {summary ? (
            <View style={{ gap: 8 }}>
              <Row label="Registrazioni nel DB" value={`${summary.recordings.count}`} />
              <Row label="File audio su S3" value={`${summary.storage.files}`} />
              <Row label="Spazio occupato" value={formatBytes(summary.storage.bytes)} />
            </View>
          ) : errors.summary ? (
            <ErrorRow message={errors.summary} />
          ) : (
            <ActivityIndicator color={Colors.secondary} />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ErrorRow({ message }: { message: string }) {
  const short = message.length > 200 ? message.slice(0, 200) + '…' : message;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
      <Text style={styles.errorText} numberOfLines={4}>{short}</Text>
    </View>
  );
}

function ElevenLabsCard({ usage }: { usage: ElevenLabsUsage }) {
  const used = usage.characterCount;
  const total = usage.characterLimit;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const reset = usage.nextResetUnix ? new Date(usage.nextResetUnix * 1000) : null;
  const resetText = reset
    ? reset.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '—';
  const barColor = pct > 90 ? '#DC2626' : pct > 70 ? '#F59E0B' : '#10B981';

  return (
    <View style={{ gap: 10 }}>
      <Row label="Piano" value={usage.tier ?? '—'} />
      <Row label="Crediti usati" value={`${used.toLocaleString('it-IT')} / ${total.toLocaleString('it-IT')}`} />
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.barMeta}>{pct.toFixed(1)}% utilizzato · reset il {resetText}</Text>
    </View>
  );
}

function RailwayCard({ usage }: { usage: RailwayUsage }) {
  const periodLabel = `${new Date(usage.periodStart).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} → oggi`;
  return (
    <View style={{ gap: 8 }}>
      <Row label="Periodo" value={periodLabel} />
      <Row label="CPU ore" value={usage.cpuHours !== null ? usage.cpuHours.toFixed(2) : '—'} />
      <Row label="Memoria GB·ora" value={usage.memoryGbHours !== null ? usage.memoryGbHours.toFixed(2) : '—'} />
      <Row label="Traffico in uscita" value={usage.networkEgressGb !== null ? `${usage.networkEgressGb.toFixed(2)} GB` : '—'} />
      <Row label="Disco usato" value={usage.diskGb !== null ? `${usage.diskGb.toFixed(2)} GB` : '—'} />
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  backText: { fontSize: 16, color: Colors.accent },
  scroll: { padding: 18, paddingBottom: 40 },
  title: { ...Fonts.title, color: Colors.label, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.secondary, marginBottom: 24 },
  sectionLabel: {
    fontSize: 12, color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: '500', marginBottom: 8, paddingLeft: 4, marginTop: 18,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 13, padding: 14,
    borderWidth: 1, borderColor: Colors.sep,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowLabel: { fontSize: 14, color: Colors.secondary, flex: 1 },
  rowValue: { fontSize: 14, color: Colors.label, fontWeight: '600' },
  barTrack: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginTop: 2,
  },
  barFill: { height: '100%', borderRadius: 3 },
  barMeta: { fontSize: 12, color: Colors.secondary },
  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10,
  },
  errorText: { fontSize: 12, color: '#DC2626', flex: 1, lineHeight: 16 },
});

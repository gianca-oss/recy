import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert, Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../src/theme';
import {
  fetchUsageSummary, fetchElevenLabsUsage, fetchRailwayUsage, getRecording,
} from '../src/services/api';
import { getAllRecordings } from '../src/stores/recordingStore';

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

interface RailwayBreakdownItem {
  label: string;
  units: number;
  unitLabel: string;
  costUsd: number;
}

interface RailwayUsage {
  periodStart: string;
  periodEnd: string | null;
  plan: string | null;
  currentUsageUsd: number | null;
  includedUsd: number | null;
  remainingIncludedUsd: number | null;
  creditBalanceUsd: number | null;
  appliedCreditsUsd: number | null;
  hasExhaustedFreePlan: boolean | null;
  isTrialing: boolean | null;
  trialDaysRemaining: number | null;
  breakdown: RailwayBreakdownItem[];
  breakdownSubtotalUsd: number;
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

  const [exporting, setExporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      const locals = await getAllRecordings();
      const enriched = await Promise.all(
        locals.map(async (r) => {
          if (r.serverId) {
            try {
              const s = await getRecording(r.serverId);
              return {
                id: r.id,
                serverId: r.serverId,
                title: r.title,
                recordedAt: r.recordedAt,
                durationSeconds: r.durationSeconds,
                source: r.source,
                syncState: r.syncState,
                status: r.status,
                transcript: s.transcriptVerbatim ?? r.transcript ?? null,
                transcriptEdited: s.transcriptEdited ?? r.transcriptEdited ?? null,
                summary: s.summary ?? r.summary ?? null,
              };
            } catch {
              // fall back to local
            }
          }
          return {
            id: r.id,
            serverId: r.serverId ?? null,
            title: r.title,
            recordedAt: r.recordedAt,
            durationSeconds: r.durationSeconds,
            source: r.source,
            syncState: r.syncState,
            status: r.status,
            transcript: r.transcript ?? null,
            transcriptEdited: r.transcriptEdited ?? null,
            summary: r.summary ?? null,
          };
        })
      );
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        count: enriched.length,
        recordings: enriched,
      };
      const d = new Date();
      const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      const filename = `recy-backup-${ts}.json`;
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Share.share({ title: filename, url: path });
    } catch (err) {
      console.error('Backup error', err);
      Alert.alert('Errore', 'Backup fallito.');
    } finally {
      setExporting(false);
    }
  }

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

        <Text style={styles.sectionLabel}>Backup</Text>
        <TouchableOpacity
          style={[styles.card, styles.backupButton, exporting && { opacity: 0.6 }]}
          onPress={exportAll}
          disabled={exporting}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <>
              <Ionicons name="archive-outline" size={20} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.backupTitle}>Esporta tutte le registrazioni</Text>
                <Text style={styles.backupSubtitle}>JSON con titoli, trascrizioni e riassunti</Text>
              </View>
              <Ionicons name="share-outline" size={20} color={Colors.accent} />
            </>
          )}
        </TouchableOpacity>
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
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const reset = usage.nextResetUnix ? new Date(usage.nextResetUnix * 1000) : null;
  const resetText = reset
    ? reset.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '—';
  const barColor = pct > 90 ? '#DC2626' : pct > 70 ? '#F59E0B' : '#10B981';

  return (
    <View style={{ gap: 10 }}>
      <Row label="Piano" value={usage.tier ?? '—'} />
      <View style={styles.costHighlight}>
        <Text style={styles.costLabel}>Crediti rimanenti</Text>
        <Text style={styles.costValue}>{remaining.toLocaleString('it-IT')}</Text>
      </View>
      <Row label="Usati" value={`${used.toLocaleString('it-IT')} / ${total.toLocaleString('it-IT')}`} />
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.barMeta}>{pct.toFixed(1)}% utilizzato · reset il {resetText}</Text>
    </View>
  );
}

function RailwayCard({ usage }: { usage: RailwayUsage }) {
  const startDate = new Date(usage.periodStart);
  const endDate = usage.periodEnd ? new Date(usage.periodEnd) : null;
  const periodLabel = endDate
    ? `${startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} → ${endDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
    : `${startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} → oggi`;

  const currentUsage = usage.currentUsageUsd ?? 0;
  const included = usage.includedUsd ?? 0;
  const remaining = usage.remainingIncludedUsd ?? 0;
  const creditBalance = usage.creditBalanceUsd;

  const pct = included > 0 ? Math.min(100, (currentUsage / included) * 100) : 0;
  const barColor = pct > 90 ? '#DC2626' : pct > 70 ? '#F59E0B' : '#10B981';

  return (
    <View style={{ gap: 10 }}>
      {usage.plan && <Row label="Piano" value={String(usage.plan).toLowerCase()} />}
      <Row label="Periodo" value={periodLabel} />

      {included > 0 && (
        <View style={styles.costHighlight}>
          <Text style={styles.costLabel}>Credito rimanente nel piano</Text>
          <Text style={styles.costValue}>${remaining.toFixed(2)}</Text>
        </View>
      )}

      <Row label="Consumo periodo" value={`$${currentUsage.toFixed(2)} / $${included.toFixed(2)}`} />
      {creditBalance !== null && creditBalance !== undefined && creditBalance > 0 && (
        <Row label="Saldo crediti account" value={`$${creditBalance.toFixed(2)}`} />
      )}

      {included > 0 && (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
      )}

      {usage.isTrialing && usage.trialDaysRemaining !== null && (
        <Text style={styles.disclaimer}>
          In prova: {usage.trialDaysRemaining} giorni rimanenti
        </Text>
      )}

      {usage.breakdown && usage.breakdown.length > 0 && (
        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownTitle}>Dettaglio costi</Text>
          {usage.breakdown.map((item) => (
            <View key={item.label} style={styles.breakdownRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownUnits}>
                  {item.units.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unitLabel}
                </Text>
              </View>
              <Text style={styles.breakdownCost}>${item.costUsd.toFixed(4)}</Text>
            </View>
          ))}
          <View style={[styles.breakdownRow, { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.sep, paddingTop: 6 }]}>
            <Text style={[styles.breakdownLabel, { fontWeight: '600' }]}>Subtotale</Text>
            <Text style={[styles.breakdownCost, { fontWeight: '700' }]}>
              ${usage.breakdownSubtotalUsd.toFixed(4)}
            </Text>
          </View>
        </View>
      )}
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
  backText: { fontSize: 18, color: Colors.accent },
  scroll: { padding: 18, paddingBottom: 40 },
  title: { ...Fonts.title, color: Colors.label, marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.secondary, marginBottom: 24 },
  sectionLabel: {
    fontSize: 14, color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: '500', marginBottom: 8, paddingLeft: 4, marginTop: 18,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 13, padding: 14,
    borderWidth: 1, borderColor: Colors.sep,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowLabel: { fontSize: 16, color: Colors.secondary, flex: 1 },
  rowValue: { fontSize: 16, color: Colors.label, fontWeight: '600' },
  barTrack: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginTop: 2,
  },
  barFill: { height: '100%', borderRadius: 3 },
  barMeta: { fontSize: 14, color: Colors.secondary },
  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10,
  },
  errorText: { fontSize: 14, color: '#DC2626', flex: 1, lineHeight: 16 },
  costHighlight: {
    backgroundColor: '#F3F4F6', borderRadius: 9, padding: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginVertical: 2,
  },
  costLabel: { fontSize: 15, color: Colors.secondary, fontWeight: '500', flex: 1 },
  costValue: { fontSize: 20, color: Colors.label, fontWeight: '700' },
  disclaimer: {
    fontSize: 13, color: Colors.tertiary, lineHeight: 15, marginTop: 4, fontStyle: 'italic',
  },
  breakdownSection: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.sep,
    gap: 6,
  },
  breakdownTitle: {
    fontSize: 13, color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.3, fontWeight: '500', marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  breakdownLabel: { fontSize: 15, color: Colors.label, fontWeight: '500' },
  breakdownUnits: { fontSize: 12, color: Colors.tertiary, marginTop: 1 },
  breakdownCost: { fontSize: 15, color: Colors.label, fontVariant: ['tabular-nums'] },
  backupButton: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  backupTitle: { fontSize: 16, color: Colors.label, fontWeight: '600' },
  backupSubtitle: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
});

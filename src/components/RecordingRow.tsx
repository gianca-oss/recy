import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getSubjectColor, Fonts } from '../theme';
import type { Recording, SyncState } from '../types';

const SyncIcons: Record<SyncState, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  local_only: { name: 'cloud-offline-outline', color: '#F59E0B' },
  uploaded: { name: 'cloud-done-outline', color: '#10B981' },
  transcribed: { name: 'checkmark-circle', color: '#10B981' },
  summarized: { name: 'sparkles', color: '#18181B' },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const recDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (recDay.getTime() === today.getTime()) return `Oggi · ${time}`;
  if (recDay.getTime() === yesterday.getTime()) return `Ieri · ${time}`;

  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${date.getDate()} ${months[date.getMonth()]} · ${time}`;
}

interface Props {
  recording: Recording;
  onPress: () => void;
  onLongPress?: () => void;
  isLast: boolean;
}

export default function RecordingRow({ recording, onPress, onLongPress, isLast }: Props) {
  const subjectColor = getSubjectColor(recording.subject);
  const sync = SyncIcons[recording.syncState];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={[styles.iconTile, { backgroundColor: subjectColor + '1a' }]}>
        <Ionicons
          name={recording.source === 'import' ? 'document-outline' : 'mic-outline'}
          size={17}
          color={subjectColor}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{recording.title}</Text>
        {recording.subject && (
          <Text style={styles.subtitle} numberOfLines={1}>{recording.subject}</Text>
        )}
        <View style={styles.metaRow}>
          <Ionicons name={sync.name} size={13} color={sync.color} />
          <Text style={styles.meta}>
            {formatDuration(recording.durationSeconds)} · {formatDate(recording.recordedAt)}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.tertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.sep,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.label,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.secondary,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  meta: {
    fontSize: 13.5,
    color: Colors.secondary,
    fontWeight: '500',
  },
});

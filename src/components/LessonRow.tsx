import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getSubjectColor, Fonts } from '../theme';
import type { Lesson, SyncState } from '../types';

const SyncIcons: Record<SyncState, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  local_only: { name: 'phone-portrait-outline', color: '#9CA3AF' },
  uploaded: { name: 'cloud-outline', color: '#6B7280' },
  transcribed: { name: 'checkmark-circle-outline', color: '#3F3F46' },
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
  const lessonDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (lessonDay.getTime() === today.getTime()) return `Oggi · ${time}`;
  if (lessonDay.getTime() === yesterday.getTime()) return `Ieri · ${time}`;

  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${date.getDate()} ${months[date.getMonth()]} · ${time}`;
}

interface Props {
  lesson: Lesson;
  onPress: () => void;
  isLast: boolean;
}

export default function LessonRow({ lesson, onPress, isLast }: Props) {
  const subjectColor = getSubjectColor(lesson.subject);
  const sync = SyncIcons[lesson.syncState];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={[styles.iconTile, { backgroundColor: subjectColor + '1a' }]}>
        <Ionicons
          name={lesson.source === 'import' ? 'document-outline' : 'mic-outline'}
          size={17}
          color={subjectColor}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{lesson.title}</Text>
        {lesson.subject && (
          <Text style={styles.subtitle} numberOfLines={1}>{lesson.subject}</Text>
        )}
        <View style={styles.metaRow}>
          <Ionicons name={sync.name} size={11} color={sync.color} />
          <Text style={styles.meta}>
            {formatDuration(lesson.durationSeconds)} · {formatDate(lesson.recordedAt)}
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
    fontSize: 15,
    fontWeight: '600',
    color: Colors.label,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
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
    fontSize: 11.5,
    color: Colors.secondary,
    fontWeight: '500',
  },
});

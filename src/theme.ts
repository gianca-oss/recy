import { StyleSheet } from 'react-native';

export const Colors = {
  bg: '#F4F4F5',
  card: '#FFFFFF',
  sep: '#E4E4E7',
  label: '#18181B',
  secondary: '#71717A',
  tertiary: '#C4C4C8',
  accent: '#27272A',
  accentDim: '#F0F0F1',
  red: '#FF3B30',
  white: '#FFFFFF',
};

export const SubjectColors: Record<string, string> = {
  Diritto: '#6B7280',
  Matematica: '#52525B',
  Storia: '#71717A',
  Fisica: '#78716C',
  Filosofia: '#64748B',
  Informatica: '#525252',
  default: '#9CA3AF',
};

export function getSubjectColor(subject: string | null): string {
  if (!subject) return SubjectColors.default;
  return SubjectColors[subject] ?? SubjectColors.default;
}

export const Fonts = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.4 },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11.5, fontWeight: '500' as const },
  timer: { fontSize: 54, fontWeight: '300' as const, letterSpacing: -1.5 },
};

export const CommonStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 13,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.sep,
  },
});

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface Props {
  metering: number;
  isActive: boolean;
  barCount?: number;
}

const BAR_COUNT = 27;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 44;

export default function AudioWaveform({ metering, isActive, barCount = BAR_COUNT }: Props) {
  const animatedValues = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(MIN_HEIGHT))
  ).current;

  useEffect(() => {
    if (!isActive) {
      animatedValues.forEach((v) => {
        Animated.timing(v, { toValue: MIN_HEIGHT, duration: 300, useNativeDriver: false }).start();
      });
      return;
    }

    // metering is dBFS (-160 to 0), normalize to 0-1
    const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));

    animatedValues.forEach((v, i) => {
      const distance = Math.abs(i - barCount / 2) / (barCount / 2);
      const scale = normalized * (1 - distance * 0.6);
      const jitter = 0.85 + Math.random() * 0.3;
      const height = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * scale * jitter;

      Animated.timing(v, {
        toValue: Math.max(MIN_HEIGHT, height),
        duration: 80 + Math.random() * 60,
        useNativeDriver: false,
      }).start();
    });
  }, [metering, isActive]);

  return (
    <View style={styles.container}>
      {animatedValues.map((height, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height,
              opacity: isActive ? 0.9 : 0.25,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 52,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
});

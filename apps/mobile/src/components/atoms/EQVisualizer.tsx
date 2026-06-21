/**
 * EQVisualizer - Animated equalizer bars
 * Shows 4 bars that animate when playing
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface EQVisualizerProps {
  color: string;
  isPlaying: boolean;
  size?: number;
}

export function EQVisualizer({ color, isPlaying, size = 15 }: EQVisualizerProps) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.3)).current;
  const bar3 = useRef(new Animated.Value(0.3)).current;
  const bar4 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!isPlaying) {
      // Reset to minimum height when not playing
      Animated.parallel([
        Animated.timing(bar1, { toValue: 0.3, duration: 200, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 0.3, duration: 200, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 0.3, duration: 200, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 0.3, duration: 200, useNativeDriver: false }),
      ]).start();
      return;
    }

    // Animate bars with different delays when playing
    const createBarAnimation = (bar: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1,
            duration: 800,
            delay,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      );
    };

    const animations = Animated.parallel([
      createBarAnimation(bar1, 0),
      createBarAnimation(bar2, 160),
      createBarAnimation(bar3, 320),
      createBarAnimation(bar4, 480),
    ]);

    animations.start();

    return () => animations.stop();
  }, [isPlaying, bar1, bar2, bar3, bar4]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {[bar1, bar2, bar3, bar4].map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: bar.interpolate({
                inputRange: [0, 1],
                outputRange: ['30%', '100%'],
              }),
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
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
  },
});

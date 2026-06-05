/**
 * Confetti celebration animation component.
 *
 * Shows a shower of confetti particles on mount — use it for
 * successful mints, purchases, and transfers.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PARTICLE_COUNT = 40;

const CONFETTI_COLORS = [
  '#6C63FF', '#00D9FF', '#10B981', '#F59E0B', '#EF4444',
  '#8B83FF', '#67E8F9', '#34D399', '#FBBF24', '#F87171',
];

interface Particle {
  x: number;
  delay: number;
  color: string;
  size: number;
}

export function ConfettiAnimation({ duration = 2500 }: { duration?: number }) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        x: Math.random() * SCREEN_W,
        delay: Math.random() * 600,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 8,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiParticle key={i} particle={p} duration={duration} />
      ))}
    </View>
  );
}

function ConfettiParticle({ particle, duration }: { particle: Particle; duration: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: duration - particle.delay,
        useNativeDriver: true,
      }).start();
    }, particle.delay);
    return () => clearTimeout(timeout);
  }, []);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, SCREEN_H + 20],
  });

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 100],
  });

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 + Math.random() * 360}deg`],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: particle.x,
        top: 0,
        width: particle.size,
        height: particle.size * 1.5,
        borderRadius: 2,
        backgroundColor: particle.color,
        transform: [{ translateY }, { translateX }, { rotate }],
        opacity,
      }}
    />
  );
}

/**
 * TickETH Reanimated Animation Utilities
 * Shared animation hooks & helpers powered by react-native-reanimated
 */

import { useEffect, useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  type SharedValue,
  runOnJS,
} from 'react-native-reanimated';

// ─── Spring Presets ─────────────────────────────────────

export const SpringPresets = {
  /** Snappy interactions — buttons, toggles */
  snappy: { damping: 15, stiffness: 200, mass: 0.8 },
  /** Smooth entrance — cards, modals */
  smooth: { damping: 20, stiffness: 120, mass: 1 },
  /** Bouncy — success states, scale pops */
  bouncy: { damping: 12, stiffness: 180, mass: 0.7 },
  /** Gentle — background transitions */
  gentle: { damping: 25, stiffness: 80, mass: 1.2 },
} as const;

// ─── Timing Presets ─────────────────────────────────────

export const TimingPresets = {
  fast: { duration: 200, easing: Easing.out(Easing.cubic) },
  normal: { duration: 350, easing: Easing.out(Easing.cubic) },
  slow: { duration: 500, easing: Easing.out(Easing.cubic) },
  entrance: { duration: 400, easing: Easing.out(Easing.exp) },
} as const;

// ─── Staggered List Item Hook ───────────────────────────

/**
 * Smooth staggered fade+slide entrance for list items.
 * Uses Reanimated worklets for 60fps performance.
 */
export function useStaggeredEntrance(index: number, maxDelay = 400) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = Math.min(index * 60, maxDelay);
    progress.value = withDelay(
      delay,
      withSpring(1, SpringPresets.smooth),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [24, 0]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.96, 0.99, 1]) },
    ],
  }));

  return animatedStyle;
}

// ─── Fade In Hook ───────────────────────────────────────

export function useFadeIn(delay = 0) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, TimingPresets.entrance));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [16, 0]) },
    ],
  }));

  return animatedStyle;
}

// ─── Scale Press Hook ───────────────────────────────────

/**
 * Micro-scale animation for pressable elements.
 * Returns { scale, onPressIn, onPressOut, animatedStyle }
 */
export function useScalePress(scaleTo = 0.97) {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, SpringPresets.snappy);
  }, []);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, SpringPresets.snappy);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { scale, onPressIn, onPressOut, animatedStyle };
}

// ─── Shimmer Hook ───────────────────────────────────────

export function useShimmer() {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  return animatedStyle;
}

// ─── Pulse Hook ─────────────────────────────────────────

export function usePulse(active = true) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, TimingPresets.fast);
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return animatedStyle;
}

// ─── Slide-in Variants ──────────────────────────────────

export function useSlideIn(
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  delay = 0,
  distance = 30,
) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SpringPresets.smooth));
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translate = interpolate(progress.value, [0, 1], [
      direction === 'down' || direction === 'right' ? -distance : distance,
      0,
    ]);

    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
      transform: [
        direction === 'left' || direction === 'right'
          ? { translateX: translate }
          : { translateY: translate },
      ],
    };
  });

  return animatedStyle;
}

// ─── Count-up Animation ─────────────────────────────────

export function useCountUp(target: number, duration = 800) {
  const current = useSharedValue(0);

  useEffect(() => {
    current.value = withTiming(target, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [target]);

  return current;
}

// ─── Progress Bar Animation ─────────────────────────────

export function useAnimatedProgress(value: number, delay = 300) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withSpring(value, { ...SpringPresets.gentle, stiffness: 60 }),
    );
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.min(width.value, 100)}%`,
  }));

  return animatedStyle;
}

// ─── Header Scroll Collapse ─────────────────────────────

export function useScrollHeader(scrollY: SharedValue<number>) {
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(scrollY.value, [0, 80], [0, -10], 'clamp') },
    ],
  }));

  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [60, 120], [0, 1], 'clamp'),
  }));

  return { headerStyle, compactHeaderStyle };
}

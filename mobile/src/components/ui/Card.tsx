import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useFadeIn, useScalePress } from '../../utils/animations';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: keyof typeof Spacing;
  onPress?: () => void;
  animated?: boolean;
  delay?: number;
}

export function Card({
  children,
  style,
  variant = 'default',
  padding = 'lg',
  onPress,
  animated = false,
  delay = 0,
}: CardProps) {
  const entranceStyle = useFadeIn(delay);
  const { onPressIn, onPressOut, animatedStyle: scaleStyle } = useScalePress(0.98);

  const cardStyle = [
    styles.base,
    { padding: Spacing[padding] },
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    animated && entranceStyle,
    onPress && scaleStyle,
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={cardStyle}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={{ margin: -Spacing[padding], padding: Spacing[padding] }}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={cardStyle}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    ...Shadows.card,
  },
  outlined: {
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glass,
  },
});

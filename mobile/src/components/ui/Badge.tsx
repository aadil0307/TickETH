import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  default: { bg: Colors.glass, text: Colors.textSecondary, border: Colors.glassBorder },
  success: { bg: Colors.successMuted, text: Colors.success, border: 'rgba(0, 214, 143, 0.2)' },
  error: { bg: Colors.errorMuted, text: Colors.error, border: 'rgba(255, 77, 106, 0.2)' },
  warning: { bg: Colors.warningMuted, text: Colors.warning, border: 'rgba(255, 184, 0, 0.2)' },
  info: { bg: Colors.accentMuted, text: Colors.accent, border: 'rgba(0, 229, 255, 0.2)' },
  primary: { bg: Colors.primaryMuted, text: Colors.primary, border: 'rgba(123, 110, 246, 0.2)' },
};

export function Badge({ label, variant = 'default', size = 'sm', style }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.md,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  text: {
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textMd: {
    fontSize: Typography.sizes.xs,
  },
});

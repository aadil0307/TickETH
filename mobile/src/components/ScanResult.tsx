import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Button } from './ui/Button';
import type { ScanResult as ScanResultType } from '../types';

interface ScanResultProps {
  result: ScanResultType;
  onScanAgain: () => void;
  onConfirmWait?: () => void;
}

const CONFIRMATION_TIMEOUT_SECONDS = 120;

export function ScanResultDisplay({ result, onScanAgain, onConfirmWait }: ScanResultProps) {
  const isSuccess = result.result === 'success';
  const isPending = result.result === 'pending_confirmation';
  const isTimeout = result.result === 'failed_confirmation_timeout';
  const isPositive = isSuccess || isPending;
  const [countdown, setCountdown] = useState(CONFIRMATION_TIMEOUT_SECONDS);

  // Determine icon / colour based on state
  let icon: keyof typeof Ionicons.glyphMap = 'close-circle';
  let color: string = Colors.error;
  let statusText = 'INVALID';

  if (isSuccess) {
    icon = 'checkmark-circle';
    color = Colors.success;
    statusText = 'ENTRY GRANTED';
  } else if (isPending) {
    icon = 'time';
    color = Colors.warning;
    statusText = 'AWAITING CONFIRMATION';
  } else if (isTimeout) {
    icon = 'timer-outline';
    color = Colors.warning;
    statusText = 'TIMED OUT';
  }

  // Haptic feedback
  useEffect(() => {
    Haptics.notificationAsync(
      isPositive
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }, [result.result]);

  // Countdown timer for pending state
  useEffect(() => {
    if (!isPending) return;
    setCountdown(CONFIRMATION_TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPending]);

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={80} color={color} />
      </View>

      {/* Status text */}
      <Text style={[styles.status, { color }]}>{statusText}</Text>

      <Text style={styles.message}>{result.message}</Text>

      {/* Countdown for pending */}
      {isPending && (
        <View style={styles.pendingSection}>
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: Spacing.sm }} />
          <Text style={styles.countdownText}>
            {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </Text>
          <Text style={styles.pendingHint}>
            Waiting for attendee to confirm on their device
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="Scan Another" onPress={onScanAgain} variant={isSuccess ? 'primary' : 'secondary'} fullWidth />
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  status: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.extrabold,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  pendingSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  countdownText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.extrabold,
    fontFamily: 'monospace',
  },
  pendingHint: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  details: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    marginBottom: Spacing['2xl'],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  actions: {
    width: '100%',
  },
});

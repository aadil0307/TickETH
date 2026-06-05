import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { usePulse } from '../utils/animations';
import QRCodeSvg from 'react-native-qrcode-svg';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface QRCodeDisplayProps {
  /** QR data to encode */
  data: string | null;
  /** Whether QR is loading/refreshing */
  loading: boolean;
  /** Error message */
  error?: string | null;
  /** Expiry timestamp (ms) */
  expiresAt?: number;
  /** Size of the QR code */
  size?: number;
}

export function QRCodeDisplay({
  data,
  loading,
  error,
  expiresAt,
  size = 240,
}: QRCodeDisplayProps) {
  // Pulse when near expiry
  const nearExpiry = !!(expiresAt && expiresAt - Date.now() < 5000 && expiresAt - Date.now() > 0);
  const pulseStyle = usePulse(nearExpiry);

  if (loading && !data) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <LoadingSpinner message="Generating QR code..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.errorText}>No QR data available</Text>
      </View>
    );
  }

  return (
    <ReAnimated.View style={[styles.qrWrapper, pulseStyle]}>
      <View style={styles.qrContainer}>
        <QRCodeSvg
          value={data}
          size={size}
          backgroundColor="#FFFFFF"
          color="#000000"
          quietZone={12}
        />
      </View>
      {loading && (
        <View style={styles.refreshOverlay}>
          <Text style={styles.refreshText}>Refreshing...</Text>
        </View>
      )}
      <Text style={styles.hint}>Show this to the scanner</Text>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrWrapper: {
    alignItems: 'center',
  },
  qrContainer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    ...({
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    }),
  },
  refreshOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});

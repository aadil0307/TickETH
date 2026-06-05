import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  Vibration,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { QRScanner } from '../../src/components/QRScanner';
import { ScanResultDisplay } from '../../src/components/ScanResult';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Button } from '../../src/components/ui/Button';
import { useScanCheckin } from '../../src/hooks/useCheckin';
import { useOfflineStore } from '../../src/stores/offlineStore';
import { syncPendingScans, downloadAllSnapshots } from '../../src/services/offline';
import { showToast } from '../../src/services/toast';
import { analytics } from '../../src/services/analytics';
import { parseError } from '../../src/services/errorParser';

export default function ScannerScreen() {
  const { scanResult, loading, error, handleScan, reset } = useScanCheckin();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const pendingCount = useOfflineStore((s) => s.pendingScans.length);
  const syncing = useOfflineStore((s) => s.syncing);

  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const flashOpacity = useSharedValue(0);
  const [flashColor, setFlashColor] = useState<string>(Colors.success);

  useEffect(() => {
    analytics.screenView('scanner');
  }, []);

  // Flash animation for scan result
  const flashScreen = useCallback(
    (success: boolean) => {
      setFlashColor(success ? Colors.success : Colors.error);
      flashOpacity.value = 1;
      flashOpacity.value = withTiming(0, { duration: 500 });
    },
    [flashOpacity],
  );

  // Enhanced scan handler with haptics + sound effects
  const enhancedHandleScan = useCallback(
    async (data: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      Vibration.vibrate(50);
      setScanCount((c) => c + 1);
      analytics.track('scan_attempted', { scanNumber: scanCount + 1, isOnline });

      try {
        await handleScan(data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        flashScreen(true);
        analytics.track('scan_success', { scanNumber: scanCount + 1 });
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        flashScreen(false);
        const parsed = parseError(err);
        analytics.track('scan_failed', { error: parsed.message });
      }
    },
    [handleScan, scanCount, isOnline, flashScreen],
  );

  // Manual code submit
  const handleManualSubmit = useCallback(() => {
    if (manualCode.trim()) {
      analytics.track('manual_code_entered', {});
      enhancedHandleScan(manualCode.trim());
      setManualCode('');
      setShowManualInput(false);
    }
  }, [manualCode, enhancedHandleScan]);

  const handleSync = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const result = await syncPendingScans();
    if (result) {
      showToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synced: ${result.synced}, Failed: ${result.failed}`,
      });
      analytics.track('offline_sync_completed', { synced: result.synced, failed: result.failed });
    }
  }, []);

  const handlePrepareOffline = useCallback(async () => {
    Alert.alert(
      'Prepare Offline Data',
      'Download ticket ownership data for all published events? This lets you verify tickets without internet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              const result = await downloadAllSnapshots();
              showToast({
                type: 'success',
                title: 'Download Complete',
                message: `Cached ${result.tickets} tickets across ${result.events} events`,
              });
            } catch (err: any) {
              const parsed = parseError(err);
              showToast({ type: 'error', title: 'Download Failed', message: parsed.message });
            }
          },
        },
      ],
    );
  }, []);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    reset();
  }, [reset]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Flash overlay for scan feedback */}
      <FlashOverlay opacity={flashOpacity} color={flashColor} />

      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Scanner
          </Text>
          <Text style={styles.subtitle}>
            {scanCount > 0 ? `${scanCount} scans this session` : 'Scan attendee QR codes'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowManualInput(!showManualInput)}
            style={styles.headerButton}
            accessibilityLabel="Enter code manually"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="keypad-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrepareOffline}
            style={[
              styles.statusPill,
              { backgroundColor: isOnline ? Colors.successMuted : Colors.warningMuted,
                borderColor: isOnline ? 'rgba(0,214,143,0.25)' : 'rgba(255,184,0,0.25)' },
            ]}
            accessibilityLabel={isOnline ? 'Online, prepare offline data' : 'Offline mode'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.success : Colors.warning }]} />
            <Text style={[styles.statusLabel, { color: isOnline ? Colors.success : Colors.warning }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Manual input bar */}
      {showManualInput && (
        <View style={styles.manualInputBar}>
          <TextInput
            style={styles.manualInput}
            placeholder="Enter ticket code manually..."
            placeholderTextColor={Colors.textMuted}
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={handleManualSubmit}
            returnKeyType="done"
            autoFocus
            accessibilityLabel="Manual ticket code input"
          />
          <TouchableOpacity
            onPress={handleManualSubmit}
            style={styles.manualSubmit}
            disabled={!manualCode.trim()}
            accessibilityLabel="Submit manual code"
          >
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={manualCode.trim() ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Offline sync bar */}
      {pendingCount > 0 && (
        <View style={styles.syncBar} accessibilityRole="alert">
          <View style={styles.syncInfo}>
            <Ionicons name="cloud-upload-outline" size={16} color={Colors.warning} />
            <Text style={styles.syncText}>
              {pendingCount} scan{pendingCount !== 1 ? 's' : ''} queued
            </Text>
          </View>
          <Button
            title={syncing ? 'Syncing...' : 'Sync Now'}
            onPress={handleSync}
            variant="outline"
            size="sm"
            loading={syncing}
            disabled={!isOnline}
          />
        </View>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {loading ? (
          <LoadingSpinner fullScreen message="Processing scan..." />
        ) : scanResult ? (
          <ScanResultDisplay result={scanResult} onScanAgain={handleReset} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Try Again"
              onPress={handleReset}
              variant="outline"
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        ) : (
          <QRScanner onScan={enhancedHandleScan} active={!loading && !scanResult} />
        )}
      </View>
    </SafeAreaView>
  );
}

import type { SharedValue } from 'react-native-reanimated';

/** Flash overlay driven by Reanimated shared value */
function FlashOverlay({ opacity, color }: { opacity: SharedValue<number>; color: string }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <ReAnimated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color, zIndex: 100 },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  manualInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  manualInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    height: 44,
  },
  manualSubmit: {
    padding: Spacing.xs,
  },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncText: {
    color: Colors.warning,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
});

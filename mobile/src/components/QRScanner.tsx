import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { Button } from './ui/Button';

interface QRScannerProps {
  /** Called when a QR code is scanned */
  onScan: (data: string) => void;
  /** Whether scanning is enabled */
  active?: boolean;
}

export function QRScanner({ onScan, active = true }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Reset scanned state when active changes
  useEffect(() => {
    if (active) setScanned(false);
  }, [active]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is needed to scan QR codes</Text>
        {!canAskAgain ? (
          <Text style={styles.subtleText}>
            Camera permission is blocked. Open Settings to allow access.
          </Text>
        ) : null}
        {permissionError ? <Text style={styles.errorText}>{permissionError}</Text> : null}
        <Button
          title={canAskAgain ? 'Grant Permission' : 'Open Settings'}
          onPress={async () => {
            try {
              setPermissionError(null);
              if (canAskAgain) {
                await requestPermission();
              } else {
                await Linking.openSettings();
              }
            } catch (err) {
              console.warn('Camera permission request failed:', err);
              setPermissionError(
                canAskAgain
                  ? 'Unable to request camera permission. Please try again.'
                  : 'Unable to open Settings. Please open it manually and allow Camera access.',
              );
            }
          }}
          variant="primary"
          style={{ marginTop: Spacing.lg }}
        />
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || !active) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Promise.resolve(onScan(data)).catch((err) => {
      console.warn('Scan handling failed:', err);
      setScanned(false);
    });

    // Allow re-scanning after 2 seconds
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Scan overlay */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanArea}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.scanText}>
              {scanned ? 'Processing...' : 'Align QR code within frame'}
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const SCAN_SIZE = 250;
const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
  },
  scanText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: Colors.primary,
    borderTopLeftRadius: BorderRadius.sm,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: Colors.primary,
    borderTopRightRadius: BorderRadius.sm,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: Colors.primary,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.sm,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing['3xl'],
  },
  subtleText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing['3xl'],
  },
});

/**
 * Global toast / snackbar notification system.
 *
 * Usage:
 *   import { showToast } from '../services/toast';
 *   showToast({ type: 'success', title: 'Minted!', message: 'Token #42' });
 *
 * The <ToastProvider /> must be rendered at the top of _layout.tsx.
 */

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

/* ─── Types ─────────────────────────────────────────────── */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  /** Auto-dismiss ms (default 3000). 0 = sticky until tapped. */
  duration?: number;
  /** Action button label */
  actionLabel?: string;
  /** Action callback */
  onAction?: () => void;
  /** Haptic (default true for error and success) */
  haptic?: boolean;
}

interface ToastState extends ToastConfig {
  id: number;
}

/* ─── Singleton emitter (so it works outside React) ─────── */

type Listener = (cfg: ToastConfig) => void;
let _listener: Listener | null = null;

export function showToast(cfg: ToastConfig) {
  _listener?.(cfg);
}

/* ─── Context (for unit tests / overrides) ──────────────── */

const ToastContext = createContext<{ show: (cfg: ToastConfig) => void }>({
  show: showToast,
});

export const useToast = () => useContext(ToastContext);

/* ─── Provider ──────────────────────────────────────────── */

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

const COLOR_MAP: Record<ToastType, string> = {
  success: Colors.success,
  error: Colors.error,
  warning: Colors.warning,
  info: Colors.accent,
};

let _nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback((cfg: ToastConfig) => {
    const id = ++_nextId;
    setToasts((prev) => [...prev.slice(-2), { ...cfg, id }]); // Keep max 3

    // Haptic
    const haptic = cfg.haptic ?? (cfg.type === 'success' || cfg.type === 'error');
    if (haptic) {
      Haptics.notificationAsync(
        cfg.type === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : cfg.type === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    }

    // Auto-dismiss
    const duration = cfg.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  // Register global listener
  useEffect(() => {
    _listener = show;
    return () => {
      _listener = null;
    };
  }, [show]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[styles.toastContainer, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/* ─── Individual toast ──────────────────────────────────── */

function ToastItem({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  const color = COLOR_MAP[toast.type];

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY }], opacity, borderLeftColor: color }]}>
      <TouchableOpacity
        style={styles.toastContent}
        onPress={handleDismiss}
        activeOpacity={0.9}
      >
        <Ionicons name={ICON_MAP[toast.type]} size={22} color={color} />
        <View style={styles.toastText}>
          <Text style={styles.toastTitle} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.message && (
            <Text style={styles.toastMessage} numberOfLines={2}>
              {toast.message}
            </Text>
          )}
        </View>
        {toast.actionLabel && toast.onAction && (
          <TouchableOpacity
            onPress={() => {
              toast.onAction?.();
              handleDismiss();
            }}
            style={styles.toastAction}
          >
            <Text style={[styles.toastActionText, { color }]}>{toast.actionLabel}</Text>
          </TouchableOpacity>
        )}
        <Ionicons name="close" size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─── Styles ────────────────────────────────────────────── */

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toast: {
    width: width - 32,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    marginBottom: 8,
    ...Shadows.lg,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  toastText: {
    flex: 1,
  },
  toastTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  toastMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  toastAction: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  toastActionText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
});

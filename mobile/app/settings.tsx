import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useFadeIn } from '../src/utils/animations';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../src/constants/theme';
import { Button } from '../src/components/ui/Button';
import { Header } from '../src/components/ui/Header';
import { useAuth } from '../src/providers/AuthProvider';
import { useWallet } from '../src/providers/WalletProvider';
import { CHAIN_CONFIG, CONTRACTS } from '../src/constants/config';
import { shortenAddress } from '../src/utils/format';
import { showToast } from '../src/services/toast';
import { analytics } from '../src/services/analytics';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { disconnect } = useWallet();

  useEffect(() => {
    analytics.screenView('settings');
  }, []);

  const handleLogout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Disconnect Wallet', 'You will be signed out of TickETH.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          analytics.track('wallet_disconnected', {});
          try {
            await disconnect();
            showToast({ type: 'info', title: 'Disconnected' });
            router.replace('/auth');
          } catch (err) {
            console.warn('Disconnect failed:', err);
            showToast({ type: 'error', title: 'Disconnect failed', message: 'Please try again.' });
          }
        },
      },
    ]);
  }, [disconnect]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Settings" leftIcon="arrow-back" onLeftPress={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <AnimatedSection delay={0}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              subtitle="Name, email, avatar"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                analytics.track('edit_profile_opened', {});
                router.push('/edit-profile');
              }}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              subtitle="Manage push notifications"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                Alert.alert('Notifications', 'Push notifications are enabled.');
              }}
              isLast
            />
          </View>
        </AnimatedSection>

        {/* Network info */}
        <AnimatedSection delay={100}>
          <Text style={styles.sectionTitle}>Network</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="globe" label="Chain" value={CHAIN_CONFIG.chainName} />
            <InfoRow icon="link" label="Chain ID" value={String(CHAIN_CONFIG.chainId)} />
            <InfoRow icon="server" label="Currency" value={CHAIN_CONFIG.nativeCurrency.symbol} />
            <InfoRow icon="cube" label="Factory" value={shortenAddress(CONTRACTS.factory, 6)} isLast />
          </View>
        </AnimatedSection>

        {/* Support */}
        <AnimatedSection delay={200}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              label="FAQ"
              subtitle="Frequently asked questions"
              onPress={() => router.push('/faq')}
            />
            <MenuItem
              icon="chatbubble-ellipses-outline"
              label="Help & Support"
              subtitle="Get help, report issues"
              onPress={() => router.push('/help-support')}
            />
            <MenuItem
              icon="document-text-outline"
              label="Terms of Service"
              subtitle="Legal & privacy"
              onPress={() => router.push('/terms')}
              isLast
            />
          </View>
        </AnimatedSection>

        {/* Disconnect */}
        <AnimatedSection delay={300}>
          <Button
            title="Disconnect Wallet"
            onPress={handleLogout}
            variant="danger"
            fullWidth
            size="lg"
            icon={<Ionicons name="log-out" size={18} color={Colors.textPrimary} />}
          />
        </AnimatedSection>

        <Text style={styles.version}>TickETH v1.0.0 · Polygon Amoy Testnet</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AnimatedSection({ delay, children }: { delay: number; children: React.ReactNode }) {
  const style = useFadeIn(delay);
  return <Animated.View style={[styles.section, style]}>{children}</Animated.View>;
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={[styles.infoRow, !isLast && styles.infoRowBorder]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${label}: ${subtitle}`}
      accessibilityRole="button"
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.menuItemIcon}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.menuItemLabel}>{label}</Text>
          <Text style={styles.menuItemSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing['6xl'],
  },
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
  },
  menuItemSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  version: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    textAlign: 'center',
    marginTop: Spacing['2xl'],
    letterSpacing: 0.5,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Linking,
  Share,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useFadeIn, useSlideIn, useScalePress } from '../../src/utils/animations';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { ProfileSkeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/providers/AuthProvider';
import { useWallet } from '../../src/providers/WalletProvider';
import { shortenAddress } from '../../src/utils/format';
import { getAddressUrl } from '../../src/services/wallet';
import { showToast } from '../../src/services/toast';
import { analytics } from '../../src/services/analytics';

export default function ProfileScreen() {
  const { user, hydrated } = useAuth();
  const { address, connected, disconnect } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => {
    analytics.screenView('profile');
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

  const copyAddress = useCallback(async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopiedAddress(true);
      showToast({ type: 'success', title: 'Copied', message: 'Address copied to clipboard' });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [address]);

  const shareAddress = useCallback(async () => {
    if (address) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Share.share({ message: `My TickETH wallet: ${address}` });
    }
  }, [address]);

  const viewOnExplorer = useCallback(() => {
    if (address) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Linking.openURL(getAddressUrl(address));
    }
  }, [address]);

  // Generate avatar color from wallet address
  const avatarColor = address ? `#${address.slice(2, 8)}` : Colors.primary;
  const avatarInitial = address ? address.slice(2, 4).toUpperCase() : '?';

  const actionsStyle = useFadeIn(600);

  // Show skeleton while hydrating
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle} accessibilityRole="header">
            Profile
          </Text>
        </View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <AnimatedProfileHeader />

        {/* Avatar & wallet card */}
        <AnimatedProfileCard avatarColor={avatarColor} avatarInitial={avatarInitial}>
          <Text style={styles.displayName}>
            {user?.display_name || 'TickETH User'}
          </Text>

          {user?.role && (
            <Badge
              label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              variant={
                user.role === 'admin'
                  ? 'error'
                  : user.role === 'organizer'
                  ? 'warning'
                  : user.role === 'volunteer'
                  ? 'info'
                  : 'primary'
              }
              size="md"
            />
          )}

          {/* Wallet address - tap to copy */}
          <TouchableOpacity
            style={styles.addressRow}
            onPress={copyAddress}
            activeOpacity={0.7}
            accessibilityLabel={`Wallet address: ${address ? shortenAddress(address, 8) : 'Not connected'}. Tap to copy.`}
            accessibilityRole="button"
          >
            <View style={styles.addressDot} />
            <Text style={styles.addressText}>
              {address ? shortenAddress(address, 8) : 'Not connected'}
            </Text>
            <Ionicons
              name={copiedAddress ? 'checkmark' : 'copy-outline'}
              size={16}
              color={copiedAddress ? Colors.success : Colors.textMuted}
            />
          </TouchableOpacity>

          {/* Quick actions row */}
          <View style={styles.quickActions}>
            <QuickActionButton icon="open-outline" label="Explorer" onPress={viewOnExplorer} accessibilityLabel="View on block explorer" />
            <QuickActionButton icon="share-outline" label="Share" onPress={shareAddress} accessibilityLabel="Share wallet address" />
            <QuickActionButton icon="copy-outline" label="Copy" onPress={copyAddress} accessibilityLabel="Copy wallet address" />
          </View>
        </AnimatedProfileCard>

        {/* Email missing prompt */}
        {user && !user.email && (
          <TouchableOpacity
            style={styles.emailBanner}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
            accessibilityLabel="Add your email address"
            accessibilityRole="button"
          >
            <Ionicons name="warning" size={18} color="#F59E0B" />
            <View style={styles.emailBannerText}>
              <Text style={styles.emailBannerTitle}>Email Required</Text>
              <Text style={styles.emailBannerSub}>
                Add your email to receive ticket copies
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Account details */}
        {user && (
          <AnimatedSection delay={300}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="finger-print" label="User ID" value={user.id.slice(0, 8) + '...'} />
              <InfoRow icon="shield-checkmark" label="Role" value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} />
              {user.email && <InfoRow icon="mail" label="Email" value={user.email} />}
              <InfoRow
                icon="time"
                label="Member Since"
                value={new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                isLast
              />
            </View>
          </AnimatedSection>
        )}

        {/* Quick Menu */}
        <AnimatedSection delay={400}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
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
              icon="settings-outline"
              label="Settings"
              subtitle="Network, support, legal"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push('/settings');
              }}
              isLast
            />
          </View>
        </AnimatedSection>

        {/* Disconnect */}
        <Animated.View style={[styles.actions, actionsStyle]}>
          <Button
            title="Disconnect Wallet"
            onPress={handleLogout}
            variant="danger"
            fullWidth
            size="lg"
            icon={<Ionicons name="log-out" size={18} color={Colors.textPrimary} />}
          />
        </Animated.View>

        <Text style={styles.version}>TickETH v1.0.0 • Polygon Amoy Testnet</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Animated header with fade-in */
function AnimatedProfileHeader() {
  const style = useFadeIn(0);
  return (
    <Animated.View style={[styles.header, style]}>
      <Text style={styles.screenTitle} accessibilityRole="header">
        Profile
      </Text>
    </Animated.View>
  );
}

/** Animated profile card with slide-up entrance */
function AnimatedProfileCard({
  avatarColor,
  avatarInitial,
  children,
}: {
  avatarColor: string;
  avatarInitial: string;
  children: React.ReactNode;
}) {
  const cardStyle = useSlideIn('down', 100, 30);
  return (
    <Animated.View style={[styles.profileCard, cardStyle]}>
      <View style={[styles.avatar, { backgroundColor: avatarColor }]} accessibilityLabel="Profile avatar">
        <Text style={styles.avatarText}>{avatarInitial}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

/** Quick action button with scale press */
function QuickActionButton({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { animatedStyle, onPressIn, onPressOut } = useScalePress(0.9);
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.quickActionIcon, animatedStyle]}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </Animated.View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Animated section wrapper */
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
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  screenTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.extrabold,
    letterSpacing: -0.5,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    padding: Spacing['2xl'],
    borderRadius: BorderRadius.xl,
    ...Shadows.card,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 3,
    borderColor: Colors.glassBorder,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.extrabold,
  },
  displayName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  addressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  addressText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontFamily: 'monospace',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing['3xl'],
    marginTop: Spacing.xl,
  },
  quickAction: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.3,
  },
  section: {
    marginTop: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
  },
  emailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  emailBannerText: {
    flex: 1,
  },
  emailBannerTitle: {
    color: Colors.warning,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  emailBannerSub: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
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
  actions: {
    marginTop: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  version: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    textAlign: 'center',
    marginTop: Spacing['2xl'],
    letterSpacing: 0.5,
  },
});

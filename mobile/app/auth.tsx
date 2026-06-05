import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useFadeIn, useSlideIn } from '../src/utils/animations';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectButton } from 'thirdweb/react-native';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import {
  thirdwebClient,
  activeChain,
  CHAIN_CONFIG,
  WALLETCONNECT_PROJECT_ID,
} from '../src/constants/config';
import { useAuth } from '../src/providers/AuthProvider';
import { authApi } from '../src/api';
import { useAuthStore } from '../src/stores/authStore';
import { useWalletStore } from '../src/stores/walletStore';
import { analytics } from '../src/services/analytics';
import { Skeleton } from '../src/components/Skeleton';
import { parseError } from '../src/services/errorParser';
import { showToast } from '../src/services/toast';

const { width, height } = Dimensions.get('window');
const isExpoGo = Constants.appOwnership === 'expo';
const hasWalletConnectProjectId = WALLETCONNECT_PROJECT_ID.trim().length > 0;
const canUseExternalWallets = !isExpoGo && hasWalletConnectProjectId;

/** Wallets offered to users */
const wallets = [
  inAppWallet({
    auth: {
      options: ['email', 'google', 'apple', 'phone'],
    },
  }),
  ...(canUseExternalWallets
    ? [
        createWallet('io.metamask'),
        createWallet('com.coinbase.wallet'),
        createWallet('me.rainbow'),
      ]
    : []),
];

/**
 * Reconstruct the EIP-4361 SIWE message from thirdweb's LoginPayload.
 * Must match thirdweb's internal createLoginMessage exactly.
 */
function createLoginMessage(payload: {
  domain: string;
  address: string;
  statement: string;
  uri?: string;
  version: string;
  chain_id?: string;
  nonce: string;
  issued_at: string;
  expiration_time: string;
  invalid_before?: string;
  resources?: string[];
}): string {
  const header = `${payload.domain} wants you to sign in with your Ethereum account:`;
  let prefix = [header, payload.address].join('\n');
  prefix = [prefix, payload.statement].join('\n\n');
  if (payload.statement) {
    prefix += '\n';
  }
  const suffixArray: string[] = [];
  if (payload.uri) {
    suffixArray.push(`URI: ${payload.uri}`);
  }
  suffixArray.push(`Version: ${payload.version}`);
  if (payload.chain_id) {
    suffixArray.push(`Chain ID: ${payload.chain_id}`);
  }
  suffixArray.push(`Nonce: ${payload.nonce}`);
  suffixArray.push(`Issued At: ${payload.issued_at}`);
  suffixArray.push(`Expiration Time: ${payload.expiration_time}`);
  if (payload.invalid_before) {
    suffixArray.push(`Not Before: ${payload.invalid_before}`);
  }
  if (payload.resources) {
    suffixArray.push(
      ['Resources:', ...payload.resources.map((x) => `- ${x}`)].join('\n'),
    );
  }
  const suffix = suffixArray.join('\n');
  return [prefix, suffix].join('\n');
}

export default function AuthScreen() {
  const { loading, isAuthenticated, hydrated } = useAuth();

  // Reanimated staggered entrance styles
  const logoStyle = useFadeIn(100);
  const titleStyle = useSlideIn('up', 300, 20);
  const featuresStyle = useSlideIn('up', 500, 30);
  const ctaStyle = useSlideIn('up', 700, 40);

  useEffect(() => {
    analytics.screenView('auth');
  }, []);

  useEffect(() => {
    if (isExpoGo) {
      showToast({
        type: 'info',
        title: 'Expo Go limitation',
        message: 'Use in-app wallet here. For MetaMask/Coinbase/Rainbow, run a development build.',
        duration: 5000,
      });
      return;
    }

    if (!hasWalletConnectProjectId) {
      showToast({
        type: 'warning',
        title: 'WalletConnect not configured',
        message: 'Add walletConnectProjectId in app.json to enable external wallets.',
        duration: 5000,
      });
    }
  }, []);

  // Navigate on authenticated
  useEffect(() => {
    if (isAuthenticated) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      analytics.track('auth_success');
      router.replace('/(tabs)/events');
    }
  }, [isAuthenticated]);

  // Shimmer skeleton during hydration
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.heroSection}>
            <Skeleton width={88} height={88} borderRadius={44} />
            <View style={{ height: 24 }} />
            <Skeleton width={180} height={36} borderRadius={8} />
            <View style={{ height: 12 }} />
            <Skeleton width={240} height={16} borderRadius={4} />
          </View>
          <View style={{ gap: Spacing.xl, paddingHorizontal: Spacing.xl }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }}>
                <Skeleton width={48} height={48} borderRadius={24} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="55%" height={14} borderRadius={4} />
                  <View style={{ height: 6 }} />
                  <Skeleton width="75%" height={12} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: Spacing.xl }}>
            <Skeleton width={width - Spacing['3xl'] * 2} height={56} borderRadius={BorderRadius.lg} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Decorative background orbs */}
        <View style={styles.orbPrimary} />
        <View style={styles.orbAccent} />

        {/* Logo & branding */}
        <ReAnimated.View
          style={[styles.heroSection, logoStyle]}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoInner}>
              <Ionicons name="ticket" size={36} color={Colors.primary} />
            </View>
          </View>
        </ReAnimated.View>

        <ReAnimated.View
          style={[
            { alignItems: 'center' },
            titleStyle,
          ]}
        >
          <Text style={styles.appName}>TickETH</Text>
          <Text style={styles.tagline}>
            NFT Ticketing on Blockchain
          </Text>
          <Text style={styles.taglineSub}>
            Secure · Transparent · Yours
          </Text>
        </ReAnimated.View>

        {/* Features */}
        <ReAnimated.View
          style={[
            styles.features,
            featuresStyle,
          ]}
        >
          <FeatureRow
            icon="shield-checkmark"
            color={Colors.success}
            title="Fraud-Proof Tickets"
            desc="Every ticket is a verifiable NFT on Polygon"
          />
          <FeatureRow
            icon="qr-code"
            color={Colors.accent}
            title="Instant Check-in"
            desc="Dynamic QR codes with two-step verification"
          />
          <FeatureRow
            icon="swap-horizontal"
            color={Colors.primary}
            title="Safe Resale"
            desc="Controlled marketplace with price caps"
          />
        </ReAnimated.View>

        {/* Thirdweb Connect Button */}
        <ReAnimated.View
          style={[
            styles.connectSection,
            ctaStyle,
          ]}
        >
          <ConnectButton
            client={thirdwebClient}
            wallets={wallets}
            chain={activeChain}
            chains={[activeChain]}
            auth={{
              async getLoginPayload({ address, chainId }) {
                try {
                  const { nonce } = await authApi.getNonce(address);
                  const now = new Date();
                  return {
                    domain: 'ticketh.io',
                    address,
                    statement: 'Sign in to TickETH',
                    uri: 'https://ticketh.io',
                    version: '1',
                    chain_id: String(chainId),
                    nonce,
                    issued_at: now.toISOString(),
                    expiration_time: new Date(
                      now.getTime() + 5 * 60 * 1000,
                    ).toISOString(),
                    invalid_before: now.toISOString(),
                  };
                } catch (err) {
                  const parsed = parseError(err);
                  showToast({
                    type: 'error',
                    title: 'Unable to start sign-in',
                    message: parsed.message,
                  });
                  throw new Error(parsed.message);
                }
              },
              async doLogin({ payload, signature }) {
                try {
                  const message = createLoginMessage(payload);
                  await useAuthStore.getState().login(message, signature);
                  useWalletStore
                    .getState()
                    .setWallet(payload.address, CHAIN_CONFIG.chainId);
                } catch (err) {
                  const parsed = parseError(err);
                  showToast({
                    type: 'error',
                    title: 'Sign-in failed',
                    message: parsed.message,
                  });
                  throw new Error(parsed.message);
                }
              },
              async isLoggedIn(_address) {
                return false;
              },
              async doLogout() {
                await useAuthStore.getState().logout();
                useWalletStore.getState().disconnect();
              },
            }}
            connectButton={{
              label: 'Get Started',
              style: {
                backgroundColor: Colors.primary,
                width: width - Spacing['3xl'] * 2,
                height: 56,
                borderRadius: BorderRadius.lg,
              },
            }}
            connectModal={{
              title: 'Sign in to TickETH',
              size: 'compact',
            }}
            theme="dark"
          />
          <Text style={styles.disclaimer}>
            By connecting, you agree to our Terms of Service
          </Text>
        </ReAnimated.View>

        {/* Network badge */}
        <View style={styles.networkBadge}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>Polygon Amoy Testnet</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function FeatureRow({
  icon,
  color,
  title,
  desc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing['3xl'],
    justifyContent: 'center',
    gap: Spacing['3xl'],
    paddingBottom: Spacing['2xl'],
    overflow: 'hidden',
  },
  // Decorative background orbs
  orbPrimary: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primary,
    opacity: 0.06,
    top: -60,
    right: -80,
  },
  orbAccent: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accent,
    opacity: 0.05,
    bottom: 60,
    left: -60,
  },
  heroSection: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  appName: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  taglineSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  features: {
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
  },
  featureDesc: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  connectSection: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  disclaimer: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    textAlign: 'center',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    alignSelf: 'center',
    backgroundColor: Colors.glass,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  networkText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    letterSpacing: 0.5,
  },
});

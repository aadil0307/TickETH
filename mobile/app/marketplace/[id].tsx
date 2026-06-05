import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useFadeIn } from '../../src/utils/animations';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useActiveAccount } from 'thirdweb/react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { EventDetailSkeleton } from '../../src/components/Skeleton';
import { ConfettiAnimation } from '../../src/components/ConfettiAnimation';
import { marketplaceApi } from '../../src/api';
import { showToast } from '../../src/services/toast';
import { parseError } from '../../src/services/errorParser';
import { analytics } from '../../src/services/analytics';
import { formatPrice, shortenAddress } from '../../src/utils/format';
import type { Listing } from '../../src/types';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useActiveAccount();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const contentStyle = useFadeIn(loading ? 99999 : 0);

  const fetchListing = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await marketplaceApi.getListingById(id);
      setListing(data);
    } catch (err) {
      const parsed = parseError(err);
      showToast({ type: 'error', title: 'Load Failed', message: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    analytics.screenView('listing_detail');
    fetchListing();
  }, [fetchListing]);

  const isSeller = account?.address?.toLowerCase() === listing?.seller_wallet?.toLowerCase();

  const handleBuy = useCallback(async () => {
    if (!listing || !account) return;

    Alert.alert(
      'Confirm Purchase',
      `Buy this ticket for ${formatPrice(listing.price)}?\n\nGas will be paid in POL.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now',
          style: 'default',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            analytics.track('listing_buy_started', { listingId: listing.id });
            setBuying(true);
            try {
              await marketplaceApi.completeSale({
                listingId: listing.id,
                txHash: '0x' + '0'.repeat(64), // placeholder
                buyerWallet: account.address,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              analytics.track('listing_bought', { listingId: listing.id });
              showToast({ type: 'success', title: 'Purchased!', message: 'The ticket is now yours.' });
              setPurchased(true);
            } catch (err) {
              const parsed = parseError(err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              showToast({ type: 'error', title: 'Purchase Failed', message: parsed.message, duration: 5000 });
              analytics.track('listing_buy_failed', { error: parsed.message });
            } finally {
              setBuying(false);
            }
          },
        },
      ],
    );
  }, [listing, account]);

  const handleCancel = useCallback(async () => {
    if (!listing) return;

    Alert.alert(
      'Cancel Listing',
      'Are you sure you want to remove this listing from the marketplace?',
      [
        { text: 'Keep Listed', style: 'cancel' },
        {
          text: 'Cancel Listing',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            analytics.track('listing_cancel_started', { listingId: listing.id });
            setCancelling(true);
            try {
              await marketplaceApi.cancelListing(listing.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              analytics.track('listing_cancelled', { listingId: listing.id });
              showToast({ type: 'success', title: 'Cancelled', message: 'Listing removed from marketplace.' });
              setCancelled(true);
            } catch (err) {
              const parsed = parseError(err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              showToast({ type: 'error', title: 'Cancel Failed', message: parsed.message, duration: 5000 });
              analytics.track('listing_cancel_failed', { error: parsed.message });
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }, [listing]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    showToast({ type: 'success', title: 'Copied', message: `${label} copied to clipboard` });
  }, []);

  // ------- Success States -------
  if (purchased) {
    return (
      <SafeAreaView style={styles.container}>
        <ConfettiAnimation />
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.successMuted }]}>
            <Ionicons name="bag-check" size={80} color={Colors.success} />
          </View>
          <Text style={styles.resultTitle}>Ticket Purchased!</Text>
          <Text style={styles.resultMessage}>
            The NFT ticket has been transferred to your wallet.
          </Text>
          <Button
            title="View My Tickets"
            onPress={() => router.replace('/(tabs)/tickets')}
            variant="primary"
            fullWidth
            size="lg"
            style={{ marginTop: Spacing['3xl'] }}
          />
          <Button
            title="Back to Marketplace"
            onPress={() => router.replace('/marketplace')}
            variant="outline"
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (cancelled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.errorMuted }]}>
            <Ionicons name="close-circle" size={80} color={Colors.error} />
          </View>
          <Text style={styles.resultTitle}>Listing Cancelled</Text>
          <Text style={styles.resultMessage}>
            Your ticket has been removed from the marketplace.
          </Text>
          <Button
            title="Back to Marketplace"
            onPress={() => router.replace('/marketplace')}
            variant="primary"
            fullWidth
            size="lg"
            style={{ marginTop: Spacing['3xl'] }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ------- Loading -------
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Listing" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={{ padding: Spacing.lg }}>
          <EventDetailSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  // ------- Not Found -------
  if (!listing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Listing" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={styles.resultContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.resultTitle}>Listing Not Found</Text>
          <Button
            title="Back to Marketplace"
            onPress={() => router.replace('/marketplace')}
            variant="outline"
            fullWidth
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    listing.status === 'active' ? Colors.success :
    listing.status === 'sold' ? Colors.primary :
    Colors.error;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Listing Details" leftIcon="arrow-back" onLeftPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={fetchListing}
            tintColor={Colors.primary}
          />
        }
      >
        <ReAnimated.View style={contentStyle}>
          {/* Event Info Card */}
          <Card variant="elevated" style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>
                  {listing.ticket?.event?.title ?? 'Event'}
                </Text>
                <Text style={styles.eventTier}>
                  {listing.ticket?.tier?.name ?? 'General Admission'} • Token #{listing.ticket?.token_id}
                </Text>
              </View>
              <Badge label={listing.status.toUpperCase()} variant={listing.status === 'active' ? 'success' : listing.status === 'sold' ? 'primary' : 'error'} />
            </View>
          </Card>

          {/* Price Card */}
          <Card variant="elevated" style={styles.priceCard}>
            <Text style={styles.priceLabel}>PRICE</Text>
            <Text style={styles.priceValue}>{formatPrice(listing.price)}</Text>
            <Text style={styles.priceSubtext}>+ gas in POL</Text>
          </Card>

          {/* Details */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Listing Info</Text>
            <DetailRow
              label="Seller"
              value={shortenAddress(listing.seller_wallet)}
              onCopy={() => copyToClipboard(listing.seller_wallet, 'Seller address')}
            />
            <DetailRow
              label="Listed"
              value={new Date(listing.created_at).toLocaleDateString(undefined, {
                dateStyle: 'medium',
              })}
            />
            {listing.tx_hash && (
              <DetailRow
                label="Tx Hash"
                value={shortenAddress(listing.tx_hash)}
                onCopy={() => copyToClipboard(listing.tx_hash!, 'Transaction hash')}
              />
            )}
            {listing.buyer_wallet && (
              <DetailRow
                label="Buyer"
                value={shortenAddress(listing.buyer_wallet)}
                onCopy={() => copyToClipboard(listing.buyer_wallet!, 'Buyer address')}
              />
            )}
            {listing.sold_at && (
              <DetailRow
                label="Sold"
                value={new Date(listing.sold_at).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              />
            )}
          </View>

          {/* Explorer Link */}
          {listing.tx_hash && (
            <TouchableOpacity
              style={styles.explorerButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                Linking.openURL(`https://amoy.polygonscan.com/tx/${listing.tx_hash}`);
              }}
              accessibilityLabel="View on explorer"
            >
              <Ionicons name="open-outline" size={16} color={Colors.primary} />
              <Text style={styles.explorerText}>View on Polygonscan</Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          {listing.status === 'active' && (
            <View style={styles.actions}>
              {!isSeller && (
                <Button
                  title={buying ? 'Processing...' : `Buy for ${formatPrice(listing.price)}`}
                  onPress={handleBuy}
                  loading={buying}
                  disabled={buying || cancelling}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="wallet" size={20} color={Colors.textPrimary} />}
                />
              )}
              {isSeller && (
                <Button
                  title={cancelling ? 'Cancelling...' : 'Cancel Listing'}
                  onPress={handleCancel}
                  loading={cancelling}
                  disabled={buying || cancelling}
                  variant="outline"
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="trash" size={20} color={Colors.error} />}
                  style={{ borderColor: Colors.error }}
                />
              )}
            </View>
          )}

          {/* Inactive Status Banner */}
          {listing.status !== 'active' && (
            <Card variant="outlined" style={styles.inactiveBanner}>
              <Ionicons
                name={listing.status === 'sold' ? 'bag-check' : 'close-circle'}
                size={24}
                color={statusColor}
              />
              <Text style={styles.inactiveText}>
                {listing.status === 'sold'
                  ? 'This ticket has been sold.'
                  : 'This listing has been cancelled.'}
              </Text>
            </Card>
          )}
        </ReAnimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Detail Row ─── */
function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <Text style={styles.detailValue}>{value}</Text>
        {onCopy && (
          <TouchableOpacity
            onPress={onCopy}
            hitSlop={8}
            accessibilityLabel={`Copy ${label}`}
          >
            <Ionicons name="copy-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
  },
  eventCard: {
    marginBottom: Spacing.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  eventTier: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: 3,
  },
  priceCard: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  priceLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  priceValue: {
    color: Colors.primary,
    fontSize: 36,
    fontWeight: Typography.weights.extrabold,
    marginTop: Spacing.xs,
    letterSpacing: -0.5,
  },
  priceSubtext: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 4,
  },
  detailSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
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
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  explorerText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  inactiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  inactiveText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    flex: 1,
    lineHeight: 20,
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  resultIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  resultTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.extrabold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  resultMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
});

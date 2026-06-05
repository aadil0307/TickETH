import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useFadeIn, useSlideIn, useScalePress } from '../../src/utils/animations';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useActiveAccount } from 'thirdweb/react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { EventDetailSkeleton } from '../../src/components/Skeleton';
import { ConfettiAnimation } from '../../src/components/ConfettiAnimation';
import { analytics } from '../../src/services/analytics';
import { parseError } from '../../src/services/errorParser';
import { showToast } from '../../src/services/toast';
import { useEvent } from '../../src/hooks/useEvents';
import { formatDateTime, formatDate, formatPrice, hasEventStarted, isEventSoon } from '../../src/utils/format';
import { getAddressUrl, getTxUrl } from '../../src/services/wallet';
import { mintTicketOnChain } from '../../src/services/contract';
import { ticketsApi, eventsApi } from '../../src/api';
import { useAuthStore } from '../../src/stores/authStore';
import type { EventStatus, TicketTier } from '../../src/types';

/* ─── Types ─────────────────────────────────────────────── */

type MintStep =
  | 'idle'
  | 'preparing'
  | 'awaiting_signature'
  | 'confirming'
  | 'finalizing'
  | 'success'
  | 'error';

interface MintResult {
  txHash: string;
  tokenId: number;
}

const MINT_STEPS: { key: MintStep; label: string }[] = [
  { key: 'preparing', label: 'Preparing transaction' },
  { key: 'awaiting_signature', label: 'Awaiting wallet signature' },
  { key: 'confirming', label: 'Confirming on-chain' },
  { key: 'finalizing', label: 'Finalizing' },
  { key: 'success', label: 'Complete!' },
];

const statusBadge: Record<EventStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  draft: { label: 'Draft', variant: 'default' },
  published: { label: 'Published', variant: 'success' },
  live: { label: 'Live', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  completed: { label: 'Completed', variant: 'default' },
};

/* ─── Mint Progress Overlay ─────────────────────────────── */

function MintProgressOverlay({
  visible,
  step,
  errorMessage,
  mintResult,
  onClose,
  onCopyTxHash,
  onViewExplorer,
  onViewTickets,
}: {
  visible: boolean;
  step: MintStep;
  errorMessage: string | null;
  mintResult: MintResult | null;
  onClose: () => void;
  onCopyTxHash: () => void;
  onViewExplorer: () => void;
  onViewTickets: () => void;
}) {
  const stepIndex = MINT_STEPS.findIndex((s) => s.key === step);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={overlayStyles.backdrop}>
        <View style={overlayStyles.card}>
          <Text style={overlayStyles.title}>
            {step === 'error' ? 'Mint Failed' : step === 'success' ? 'Ticket Minted!' : 'Minting Ticket'}
          </Text>

          {/* Step indicators */}
          <View style={overlayStyles.steps}>
            {MINT_STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isDone = stepIndex > i || step === 'success';
              const isFailed = step === 'error' && i === stepIndex;
              return (
                <View key={s.key} style={overlayStyles.stepRow}>
                  <View
                    style={[
                      overlayStyles.stepDot,
                      isDone && overlayStyles.stepDotDone,
                      isActive && !isDone && overlayStyles.stepDotActive,
                      isFailed && overlayStyles.stepDotError,
                    ]}
                  >
                    {isDone && <Ionicons name="checkmark" size={12} color={Colors.textPrimary} />}
                    {isFailed && <Ionicons name="close" size={12} color={Colors.textPrimary} />}
                  </View>
                  <Text
                    style={[
                      overlayStyles.stepLabel,
                      isDone && overlayStyles.stepLabelDone,
                      isActive && overlayStyles.stepLabelActive,
                      isFailed && overlayStyles.stepLabelError,
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Error message */}
          {step === 'error' && errorMessage && (
            <View style={overlayStyles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={overlayStyles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Success actions */}
          {step === 'success' && mintResult && (
            <View style={overlayStyles.successActions}>
              <Text style={overlayStyles.txLabel}>
                Tx: {mintResult.txHash.slice(0, 10)}...{mintResult.txHash.slice(-8)}
              </Text>
              <View style={overlayStyles.successButtons}>
                <TouchableOpacity
                  style={overlayStyles.actionBtn}
                  onPress={onCopyTxHash}
                  accessibilityLabel="Copy transaction hash"
                  accessibilityRole="button"
                >
                  <Ionicons name="copy-outline" size={16} color={Colors.accent} />
                  <Text style={overlayStyles.actionBtnText}>Copy Tx Hash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={overlayStyles.actionBtn}
                  onPress={onViewExplorer}
                  accessibilityLabel="View transaction on block explorer"
                  accessibilityRole="link"
                >
                  <Ionicons name="open-outline" size={16} color={Colors.accent} />
                  <Text style={overlayStyles.actionBtnText}>View on Explorer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer buttons */}
          {(step === 'success' || step === 'error') && (
            <View style={overlayStyles.footer}>
              {step === 'success' && (
                <Button
                  title="View My Tickets"
                  onPress={onViewTickets}
                  fullWidth
                  size="lg"
                  style={{ marginBottom: Spacing.sm }}
                />
              )}
              <Button
                title={step === 'error' ? 'Dismiss' : 'Close'}
                onPress={onClose}
                variant="outline"
                fullWidth
                size="md"
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ─── Main Screen ───────────────────────────────────────── */

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading, error, refresh } = useEvent(id);
  const activeAccount = useActiveAccount();
  const { user } = useAuthStore();

  const canDelete =
    !!user &&
    !!event &&
    (user.role === 'admin' || user.role === 'super_admin' || event.organizer_id === user.id);

  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mintStep, setMintStep] = useState<MintStep>('idle');
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Animated entrance for content
  const contentStyle = useFadeIn(loading || !event ? 99999 : 0);

  // Analytics: screen view
  useEffect(() => {
    if (id) analytics.screenView('event_detail', { event_id: id });
  }, [id]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleTierSelect = (tier: TicketTier, isSelected: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTier(isSelected ? null : tier);
  };

  const handleMint = () => {
    if (!selectedTier) return;
    Alert.alert(
      'Mint Ticket',
      `Mint a "${selectedTier.name}" ticket for ${formatPrice(selectedTier.price_wei)}?\n\nThis will create an NFT on the Polygon network.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Mint', onPress: executeMint },
      ],
    );
  };

  const executeMint = async () => {
    if (!activeAccount) {
      Alert.alert('Wallet Required', 'Please connect your wallet to mint.');
      return;
    }
    if (!event?.contract_address) {
      Alert.alert('Not Available', 'Contract not yet deployed for this event.');
      return;
    }
    if (!selectedTier) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.track('mint_started', { event_id: id!, tier_id: selectedTier.id });

    setMintError(null);
    setMintResult(null);
    setMintStep('preparing');

    try {
      setMintStep('awaiting_signature');
      const tierIndex = selectedTier.tier_index ?? event.tiers!.findIndex((t) => t.id === selectedTier.id);

      setMintStep('confirming');
      // Use price_wei (exact wei string) for on-chain value; fall back to parseEther if missing
      const priceWei = selectedTier.price_wei && selectedTier.price_wei !== '0'
        ? selectedTier.price_wei
        : (() => { const { ethers } = require('ethers'); return ethers.parseEther(selectedTier.price).toString(); })();

      const { txHash, tokenId } = await mintTicketOnChain({
        contractAddress: event.contract_address,
        tierIndex,
        price: priceWei,
        account: activeAccount,
      });

      setMintStep('finalizing');
      await ticketsApi.recordMint({
        eventId: event.id,
        tierId: selectedTier.id,
        contractAddress: event.contract_address,
        tokenId,
        txHash,
        ownerWallet: activeAccount.address,
      });

      setMintResult({ txHash, tokenId });
      setMintStep('success');
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      analytics.track('mint_success', { event_id: id!, tier_id: selectedTier.id, tx_hash: txHash });
      showToast({ type: 'success', title: 'Ticket Minted!', message: 'Your NFT ticket is on-chain.' });
    } catch (err: unknown) {
      const parsed = parseError(err);
      setMintError(parsed.message);
      setMintStep('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      analytics.track('mint_failed', { event_id: id!, tier_id: selectedTier.id, error: parsed.message });
    }
  };

  const handleCopyTxHash = async () => {
    if (!mintResult) return;
    await Clipboard.setStringAsync(mintResult.txHash);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({ type: 'info', title: 'Copied', message: 'Transaction hash copied to clipboard.' });
  };

  const handleViewExplorer = () => {
    if (!mintResult) return;
    Linking.openURL(getTxUrl(mintResult.txHash));
  };

  const handleCloseMintOverlay = () => {
    setMintStep('idle');
    setMintError(null);
    if (mintResult) refresh();
  };

  const minting = mintStep !== 'idle' && mintStep !== 'success' && mintStep !== 'error';

  const handleDeleteEvent = () => {
    if (!event) return;
    Alert.alert(
      'Delete Event',
      `Are you sure you want to permanently delete "${event.title}"?\n\nEvents with minted tickets cannot be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await eventsApi.deleteEvent(event.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showToast({ type: 'success', title: 'Event Deleted', message: 'Event has been permanently removed.' });
              router.back();
            } catch (err: unknown) {
              const parsed = parseError(err);
              showToast({ type: 'error', title: 'Delete Failed', message: parsed.message });
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ],
    );
  };

  /* ─── Loading state ───────────────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <EventDetailSkeleton />
      </SafeAreaView>
    );
  }

  /* ─── Error / not found ───────────────────────────────── */

  if (error || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Event" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error ?? 'Event not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const status = statusBadge[event.status] ?? statusBadge.draft;
  const started = hasEventStarted(event.start_time);
  const soon = isEventSoon(event.start_time);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Confetti celebration */}
      {showConfetti && <ConfettiAnimation duration={3000} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surface}
          />
        }
      >
        {/* Banner */}
        <View style={styles.bannerWrapper}>
          {event.banner_url ? (
            <Image source={{ uri: event.banner_url }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder]}>
              <Ionicons name="image-outline" size={48} color={Colors.textMuted} />
            </View>
          )}
          {/* Back button overlay */}
          <SafeAreaView style={styles.backButton} edges={[]}>
            <Button
              title=""
              onPress={() => router.back()}
              variant="ghost"
              size="sm"
              icon={<Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />}
              style={styles.backButtonInner}
            />
          </SafeAreaView>
        </View>

        {/* Content with fade-in */}
        <ReAnimated.View style={[styles.content, contentStyle]}>
          {/* Status & timing */}
          <View style={styles.badges}>
            <Badge label={status.label} variant={status.variant} size="md" />
            {soon && !started && <Badge label="Starting Soon" variant="warning" size="md" />}
            {started && <Badge label="In Progress" variant="error" size="md" />}
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {event.title}
          </Text>

          {/* Details grid */}
          <View style={styles.detailsGrid}>
            <DetailItem icon="calendar" label="Date" value={formatDateTime(event.start_time)} />
            <DetailItem icon="location" label="Venue" value={event.venue} />
            {event.contract_address && (
              <DetailItem
                icon="cube"
                label="Contract"
                value={`${event.contract_address.slice(0, 10)}...`}
                onPress={() => Linking.openURL(getAddressUrl(event.contract_address!))}
              />
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {/* Ticket Tiers */}
          {event.tiers && event.tiers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Ticket Tier</Text>
              {event.tiers.map((tier, index) => {
                const soldOut = tier.minted >= tier.max_supply;
                const isSelected = selectedTier?.id === tier.id;
                return (
                  <AnimatedTierCard key={tier.id} index={index}>
                    <TouchableOpacity
                      style={[
                        styles.tierCard,
                        isSelected && styles.tierCardSelected,
                        soldOut && styles.tierCardSoldOut,
                      ]}
                      onPress={() => !soldOut && handleTierSelect(tier, isSelected)}
                      activeOpacity={soldOut ? 1 : 0.7}
                      disabled={soldOut}
                      accessibilityLabel={`${tier.name} tier, ${formatPrice(tier.price_wei)}${soldOut ? ', sold out' : ''}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: soldOut }}
                    >
                      {/* Sold-out overlay */}
                      {soldOut && (
                        <View style={styles.soldOutOverlay}>
                          <Ionicons name="lock-closed" size={28} color={Colors.textMuted} />
                          <Text style={styles.soldOutLabel}>Sold Out</Text>
                        </View>
                      )}

                      <View style={styles.tierHeader}>
                        <View style={styles.tierNameRow}>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                          )}
                          <Text style={styles.tierName}>{tier.name}</Text>
                        </View>
                        <Text style={[styles.tierPrice, soldOut && { color: Colors.textMuted }]}>
                          {formatPrice(tier.price_wei)}
                        </Text>
                      </View>
                      <View style={styles.tierMeta}>
                        <Text style={styles.tierSupply}>
                          {soldOut ? 'Sold Out' : `${tier.max_supply - tier.minted} remaining`}
                        </Text>
                        {tier.resale_allowed && <Badge label="Resale OK" variant="info" />}
                      </View>
                      {tier.description && <Text style={styles.tierDesc}>{tier.description}</Text>}
                      <View style={styles.tierProgress}>
                        <View
                          style={[
                            styles.tierProgressFill,
                            {
                              width: `${Math.min(
                                (tier.minted / Math.max(tier.max_supply, 1)) * 100,
                                100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    </TouchableOpacity>
                  </AnimatedTierCard>
                );
              })}
            </View>
          )}

          {/* Delete Event (organizer / admin only) */}
          {canDelete && (
            <View style={styles.deleteSection}>
              <Button
                title={deleteLoading ? 'Deleting...' : 'Delete Event'}
                onPress={handleDeleteEvent}
                variant="outline"
                loading={deleteLoading}
                icon={<Ionicons name="trash-outline" size={18} color={Colors.error} />}
                style={styles.deleteButton}
                textStyle={{ color: Colors.error }}
              />
            </View>
          )}

          {/* Mint CTA */}
          {event.status === 'published' && !started && (
            <View style={styles.mintSection}>
              {selectedTier ? (
                <>
                  <View style={styles.mintSummary}>
                    <Text style={styles.mintSummaryLabel}>Selected</Text>
                    <Text style={styles.mintSummaryValue}>{selectedTier.name}</Text>
                    <Text style={styles.mintSummaryPrice}>{formatPrice(selectedTier.price_wei)}</Text>
                  </View>
                  <Button
                    title={minting ? 'Minting...' : 'Mint NFT Ticket'}
                    onPress={handleMint}
                    loading={minting}
                    fullWidth
                    size="lg"
                    icon={<Ionicons name="flash" size={20} color={Colors.textPrimary} />}
                    style={{ marginTop: Spacing.md }}
                  />
                </>
              ) : (
                <Text style={styles.selectHint}>Select a ticket tier above to mint</Text>
              )}
            </View>
          )}
        </ReAnimated.View>
      </ScrollView>

      {/* Mint progress modal */}
      <MintProgressOverlay
        visible={mintStep !== 'idle'}
        step={mintStep}
        errorMessage={mintError}
        mintResult={mintResult}
        onClose={handleCloseMintOverlay}
        onCopyTxHash={handleCopyTxHash}
        onViewExplorer={handleViewExplorer}
        onViewTickets={() => {
          handleCloseMintOverlay();
          router.push('/(tabs)/tickets');
        }}
      />
    </SafeAreaView>
  );
}

/* ─── Animated Tier Card ────────────────────────────────── */

function AnimatedTierCard({ index, children }: { index: number; children: React.ReactNode }) {
  const entranceStyle = useSlideIn('up', 100 + index * 80, 20);
  const { animatedStyle, onPressIn, onPressOut } = useScalePress(0.97);

  return (
    <ReAnimated.View style={[entranceStyle, animatedStyle]}>
      {children}
    </ReAnimated.View>
  );
}

/* ─── Detail Item ───────────────────────────────────────── */

function DetailItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.detailItem} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[styles.detailValue, onPress && styles.detailLink]}
          onPress={onPress}
          accessibilityRole={onPress ? 'link' : 'text'}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bannerWrapper: {
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: 260,
  },
  bannerPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Spacing.xl,
    left: Spacing.lg,
  },
  backButtonInner: {
    backgroundColor: 'rgba(8, 8, 15, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  content: {
    padding: Spacing.xl,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.extrabold,
    marginBottom: Spacing.xl,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  detailsGrid: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.3,
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
  },
  detailLink: {
    color: Colors.accent,
  },
  section: {
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
  description: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    lineHeight: 24,
  },
  tierCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  tierCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceHighlight,
  },
  tierCardSoldOut: {
    opacity: 0.5,
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,15,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: BorderRadius.lg,
  },
  soldOutLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tierName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  tierPrice: {
    color: Colors.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.extrabold,
  },
  tierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tierSupply: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  tierDesc: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  tierProgress: {
    height: 3,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tierProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  mintSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mintSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mintSummaryLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  mintSummaryValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  mintSummaryPrice: {
    color: Colors.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.extrabold,
  },
  selectHint: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  deleteSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteButton: {
    borderColor: Colors.error,
  },
});

/* ─── Overlay Styles ────────────────────────────────────── */

const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,8,15,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    letterSpacing: -0.3,
  },
  steps: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  stepDotDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepDotError: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  stepLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  stepLabelDone: {
    color: Colors.textSecondary,
  },
  stepLabelActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  stepLabelError: {
    color: Colors.error,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.errorMuted,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.15)',
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    flex: 1,
    lineHeight: 20,
  },
  successActions: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  txLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontFamily: 'monospace',
    marginBottom: Spacing.md,
  },
  successButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  actionBtnText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  deleteSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteButton: {
    borderColor: Colors.error,
  },
  footer: {
    marginTop: Spacing.sm,
  },
});

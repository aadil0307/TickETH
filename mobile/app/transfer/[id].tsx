import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useFadeIn } from '../../src/utils/animations';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useActiveAccount } from 'thirdweb/react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { TicketCardSkeleton } from '../../src/components/Skeleton';
import { ConfettiAnimation } from '../../src/components/ConfettiAnimation';
import { useTicket } from '../../src/hooks/useTickets';
import { transferTicketOnChain } from '../../src/services/contract';
import { isValidAddress } from '../../src/services/wallet';
import { parseError } from '../../src/services/errorParser';
import { showToast } from '../../src/services/toast';
import { analytics } from '../../src/services/analytics';
import { shortenAddress, formatPrice } from '../../src/utils/format';

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ticket, loading, error } = useTicket(id ?? '');
  const account = useActiveAccount();

  const [toAddress, setToAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const contentStyle = useFadeIn(0);
  const successStyle = useFadeIn(success ? 0 : 99999);

  useEffect(() => {
    analytics.screenView('transfer');
  }, []);

  /* ── Validate address ─────────────────────────────────── */
  const validateAddress = useCallback(
    (addr: string) => {
      const trimmed = addr.trim();
      setToAddress(trimmed);
      if (!trimmed) {
        setAddressError(null);
        return;
      }
      if (!isValidAddress(trimmed)) {
        setAddressError('Invalid Ethereum address');
      } else if (trimmed.toLowerCase() === account?.address?.toLowerCase()) {
        setAddressError('Cannot transfer to yourself');
      } else {
        setAddressError(null);
      }
    },
    [account?.address],
  );

  /* ── Paste from clipboard ─────────────────────────────── */
  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        validateAddress(text);
      } else {
        showToast({ type: 'info', title: 'Clipboard empty' });
      }
    } catch {
      showToast({ type: 'error', title: 'Cannot access clipboard' });
    }
  }, [validateAddress]);

  /* ── Transfer handler ─────────────────────────────────── */
  const handleTransfer = useCallback(async () => {
    if (!ticket || !account || !toAddress || addressError) return;

    analytics.track('transfer_started', { ticketId: ticket.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTransferring(true);

    try {
      const { txHash } = await transferTicketOnChain({
        contractAddress: ticket.contract_address,
        tokenId: ticket.token_id,
        fromAddress: account.address,
        toAddress,
        account,
      });

      analytics.track('transfer_success', { ticketId: ticket.id, txHash });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccess(txHash);
      setShowConfetti(true);

      showToast({ type: 'success', title: 'Transfer Complete!', message: 'Your ticket has been transferred.' });
    } catch (err: any) {
      const parsed = parseError(err);
      analytics.track('transfer_failed', { ticketId: ticket.id, error: parsed.message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showToast({
        type: 'error',
        title: 'Transfer Failed',
        message: parsed.message,
        duration: 5000,
      });
    } finally {
      setTransferring(false);
    }
  }, [ticket, account, toAddress, addressError]);

  /* ── Loading state ────────────────────────────────────── */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Transfer" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={{ padding: Spacing.lg }}>
          <TicketCardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Error state ──────────────────────────────────────── */
  if (error || !ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Transfer" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error ?? 'Ticket not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Success state ────────────────────────────────────── */
  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        {showConfetti && <ConfettiAnimation />}
        <ReAnimated.View style={[styles.resultContainer, successStyle]}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.successMuted }]}>
            <Ionicons name="checkmark-circle" size={96} color={Colors.success} />
          </View>
          <Text style={styles.resultTitle}>Transfer Complete!</Text>
          <Text style={styles.resultMessage}>
            Your ticket has been transferred to{'\n'}
            {shortenAddress(toAddress)}
          </Text>
          <TouchableOpacity
            style={styles.txHashRow}
            onPress={async () => {
              await Clipboard.setStringAsync(success);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              showToast({ type: 'success', title: 'Copied', message: 'Tx hash copied' });
            }}
            accessibilityLabel="Copy transaction hash"
          >
            <Text style={styles.txHash}>Tx: {shortenAddress(success, 10)}</Text>
            <Ionicons name="copy-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <Button
            title="Back to Tickets"
            onPress={() => router.replace('/(tabs)/tickets')}
            variant="primary"
            fullWidth
            size="lg"
            style={{ marginTop: Spacing['3xl'] }}
          />
        </ReAnimated.View>
      </SafeAreaView>
    );
  }

  /* ── Main form ────────────────────────────────────────── */
  const canTransfer =
    toAddress.length > 0 && !addressError && !transferring && ticket.status === 'minted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Transfer Ticket" leftIcon="arrow-back" onLeftPress={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ReAnimated.View style={contentStyle}>
            {/* Warning banner */}
            <View style={styles.warningBanner} accessibilityRole="alert">
              <Ionicons name="warning" size={20} color={Colors.warning} />
              <Text style={styles.warningText}>
                Transfers are on-chain and irreversible. Double-check the recipient address.
              </Text>
            </View>

            {/* Ticket summary */}
            <Card variant="elevated" style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketTitle}>{ticket.event?.title ?? 'Event'}</Text>
                  <Text style={styles.ticketTier}>{ticket.tier?.name ?? 'General'}</Text>
                </View>
                <Badge label={`#${ticket.token_id}`} variant="primary" size="md" />
              </View>
              {ticket.tier?.price && (
                <View style={styles.ticketDetail}>
                  <Ionicons name="diamond-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.ticketDetailText}>
                    Original price: {formatPrice(ticket.tier.price_wei)}
                  </Text>
                </View>
              )}
              <View style={styles.ticketDetail}>
                <Ionicons name="wallet-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.ticketDetailText}>
                  From: {shortenAddress(ticket.owner_wallet)}
                </Text>
              </View>
            </Card>

            {/* Destination input */}
            <View style={styles.inputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Recipient Wallet Address</Text>
                <TouchableOpacity
                  onPress={pasteFromClipboard}
                  style={styles.pasteButton}
                  accessibilityLabel="Paste address from clipboard"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="clipboard-outline" size={14} color={Colors.primary} />
                  <Text style={styles.pasteButtonText}>Paste</Text>
                </TouchableOpacity>
              </View>
              <Input
                placeholder="0x..."
                value={toAddress}
                onChangeText={validateAddress}
                error={addressError ?? undefined}
                autoCapitalize="none"
                autoCorrect={false}
                icon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
              />
            </View>

            {/* Transfer details preview */}
            {toAddress && !addressError && (
              <Card variant="outlined" style={styles.previewCard}>
                <Text style={styles.previewTitle}>Transfer Summary</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>To</Text>
                  <Text style={styles.previewValue}>{shortenAddress(toAddress, 8)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Token ID</Text>
                  <Text style={styles.previewValue}>#{ticket.token_id}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Gas</Text>
                  <Text style={styles.previewValue}>Paid in POL</Text>
                </View>
              </Card>
            )}

            {/* Submit */}
            <Button
              title={transferring ? 'Transferring...' : 'Transfer Ticket'}
              onPress={handleTransfer}
              loading={transferring}
              disabled={!canTransfer}
              fullWidth
              size="lg"
              icon={<Ionicons name="swap-horizontal" size={20} color={Colors.textPrimary} />}
              style={{ marginTop: Spacing.xl }}
            />
          </ReAnimated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningMuted,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
  },
  warningText: {
    color: Colors.warning,
    fontSize: Typography.sizes.sm,
    flex: 1,
    lineHeight: 20,
  },
  ticketCard: {
    marginBottom: Spacing.xl,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  ticketTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  ticketTier: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 3,
  },
  ticketDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  ticketDetailText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  pasteButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  previewCard: {
    marginBottom: Spacing.md,
  },
  previewTitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  previewLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  previewValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
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
    letterSpacing: -0.3,
  },
  resultMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  txHashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  txHash: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontFamily: 'monospace',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing['3xl'],
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
});

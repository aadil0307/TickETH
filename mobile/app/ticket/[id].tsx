import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useFadeIn } from '../../src/utils/animations';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { QRCodeDisplay } from '../../src/components/QRCodeDisplay';
import { TicketCardSkeleton } from '../../src/components/Skeleton';
import { useTicket } from '../../src/hooks/useTickets';
import { useTicketQR } from '../../src/hooks/useCheckin';
import { useCheckin } from '../../src/providers/CheckinProvider';
import { showToast } from '../../src/services/toast';
import { analytics } from '../../src/services/analytics';
import {
  formatDateTime,
  formatPrice,
  formatTicketStatus,
  shortenAddress,
} from '../../src/utils/format';
import { getTxUrl, getTokenUrl } from '../../src/services/wallet';
import type { TicketStatus } from '../../src/types';

const statusVariant: Record<TicketStatus, 'success' | 'default' | 'warning' | 'info' | 'error'> = {
  minted: 'success',
  checked_in: 'default',
  transferred: 'warning',
  listed: 'info',
  invalidated: 'error',
};

export default function TicketDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const { ticket, loading, error, refresh } = useTicket(id);
  const eventId = ticket?.event_id ?? '';
  const { qrPayload, loading: qrLoading, error: qrError, refresh: refreshQR } = useTicketQR(id, eventId);
  const { joinTicket } = useCheckin();

  const contentStyle = useFadeIn(0);

  useEffect(() => {
    analytics.screenView('ticket_detail');
  }, []);

  // Join the ticket WebSocket room so the attendee receives confirmationRequest
  useEffect(() => {
    if (id && ticket?.status === 'minted') {
      joinTicket(id);
    }
  }, [id, ticket?.status, joinTicket]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refresh();
  }, [refresh]);

  const handleRefreshQR = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    refreshQR();
  }, [refreshQR]);

  const copyTxHash = useCallback(async () => {
    if (ticket?.tx_hash) {
      await Clipboard.setStringAsync(ticket.tx_hash);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({ type: 'success', title: 'Copied', message: 'Tx hash copied to clipboard' });
    }
  }, [ticket?.tx_hash]);

  /* ── Loading state ──────────────────────────────────── */
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Ticket Details" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={styles.scrollContent}>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Error state ────────────────────────────────────── */
  if (error || !ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Ticket" leftIcon="arrow-back" onLeftPress={() => router.back()} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error ?? 'Ticket not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = ticket.status === 'minted';
  const isTransferred = ticket.status === 'transferred';
  const isCheckedIn = ticket.status === 'checked_in';

  // Expiration indicator
  const eventDate = ticket.event?.start_time ? new Date(ticket.event.start_time) : null;
  const isExpired = eventDate ? eventDate < new Date() : false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Ticket Details" leftIcon="arrow-back" onLeftPress={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <ReAnimated.View style={contentStyle}>
          {/* Event info header */}
          <View style={styles.eventHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle} accessibilityRole="header" numberOfLines={2}>
                {ticket.event?.title ?? 'Event'}
              </Text>
              {ticket.tier?.name && (
                <View style={styles.tierBadge}>
                  <Ionicons name="ribbon-outline" size={12} color={Colors.accent} />
                  <Text style={styles.tierBadgeText}>{ticket.tier.name}</Text>
                </View>
              )}
              {isExpired && !isCheckedIn && (
                <View style={styles.expiredBadge}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.expiredText}>Event has passed</Text>
                </View>
              )}
            </View>
            <Badge
              label={formatTicketStatus(ticket.status)}
              variant={statusVariant[ticket.status]}
              size="md"
            />
          </View>

          {/* QR Code section — active tickets only */}
          {isActive && !isTransferred && (
            <View style={styles.qrSection}>
              <QRCodeDisplay
                data={qrPayload ? JSON.stringify(qrPayload) : null}
                loading={qrLoading}
                error={qrError}
                expiresAt={qrPayload?.expiresAt}
                size={220}
              />
              <TouchableOpacity
                style={styles.refreshQRButton}
                onPress={handleRefreshQR}
                accessibilityLabel="Refresh QR code"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="refresh" size={16} color={Colors.primary} />
                <Text style={styles.refreshQRText}>Refresh QR</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Transferred indicator */}
          {isTransferred && (
            <Card variant="elevated" style={styles.statusCard}>
              <View style={styles.statusCardContent}>
                <Ionicons name="swap-horizontal" size={32} color={Colors.warning} />
                <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                  <Text style={[styles.statusCardTitle, { color: Colors.warning }]}>
                    Transferred
                  </Text>
                  <Text style={styles.statusCardSubtitle}>
                    This ticket has been transferred to another wallet.
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Checked-in indicator */}
          {isCheckedIn && ticket.checked_in_at && (
            <Card variant="elevated" style={styles.checkedInCard}>
              <View style={styles.statusCardContent}>
                <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
                <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                  <Text style={styles.statusCardTitle}>Checked In</Text>
                  <Text style={styles.statusCardSubtitle}>
                    {formatDateTime(ticket.checked_in_at)}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Ticket details card */}
          <Card variant="elevated" style={styles.detailsCard}>
            <DetailRow label="Token ID" value={`#${ticket.token_id}`} />
            <DetailRow label="Tier" value={ticket.tier?.name ?? '—'} />
            {ticket.tier?.price && (
              <DetailRow label="Price" value={formatPrice(ticket.tier.price_wei)} />
            )}
            <DetailRow label="Owner" value={shortenAddress(ticket.owner_wallet)} />
            <DetailRow
              label="Contract"
              value={shortenAddress(ticket.contract_address)}
              onPress={() =>
                Linking.openURL(getTokenUrl(ticket.contract_address, ticket.token_id))
              }
            />
            {ticket.event?.start_time && (
              <DetailRow label="Event Date" value={formatDateTime(ticket.event.start_time)} />
            )}
            {ticket.event?.venue && (
              <DetailRow label="Venue" value={ticket.event.venue} />
            )}
            {ticket.minted_at && (
              <DetailRow label="Minted" value={formatDateTime(ticket.minted_at)} />
            )}
            {ticket.tx_hash && (
              <DetailRow
                label="Tx Hash"
                value={`${ticket.tx_hash.slice(0, 10)}...`}
                onPress={copyTxHash}
                icon="copy-outline"
              />
            )}
          </Card>

          {/* Actions */}
          {isActive && (
            <View style={styles.actions}>
              <Button
                title="Transfer Ticket"
                onPress={() => {
                  analytics.track('transfer_initiated', { ticketId: ticket.id });
                  router.push(`/transfer/${ticket.id}`);
                }}
                variant="secondary"
                fullWidth
                icon={<Ionicons name="swap-horizontal" size={18} color={Colors.textPrimary} />}
              />
              <Button
                title="View on Explorer"
                onPress={() =>
                  Linking.openURL(getTokenUrl(ticket.contract_address, ticket.token_id))
                }
                variant="outline"
                fullWidth
                icon={<Ionicons name="open-outline" size={18} color={Colors.primary} />}
              />
            </View>
          )}
        </ReAnimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  onPress,
  icon,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      style={styles.detailRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text
          style={[styles.detailValue, onPress && styles.detailLink]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {icon && <Ionicons name={icon} size={14} color={Colors.accent} />}
      </View>
    </TouchableOpacity>
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
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  eventTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.extrabold,
    flex: 1,
    marginRight: Spacing.md,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: Colors.accentMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  tierBadgeText: {
    color: Colors.accent,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: Colors.warningMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  expiredText: {
    color: Colors.warning,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  refreshQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  refreshQRText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  statusCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCardTitle: {
    color: Colors.success,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  statusCardSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  checkedInCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.successMuted,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
  },
  detailsCard: {
    marginBottom: Spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 48,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '60%',
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    textAlign: 'right',
  },
  detailLink: {
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  actions: {
    gap: Spacing.md,
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

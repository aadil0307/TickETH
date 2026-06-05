import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Badge } from './ui/Badge';
import { useScalePress } from '../utils/animations';
import { formatDate, formatPrice, formatTicketStatus } from '../utils/format';
import type { Ticket, TicketStatus } from '../types';

interface TicketCardProps {
  ticket: Ticket;
  onPress: () => void;
}

const statusVariant: Record<TicketStatus, 'success' | 'default' | 'warning' | 'info' | 'error'> = {
  minted: 'success',
  checked_in: 'default',
  transferred: 'warning',
  listed: 'info',
  invalidated: 'error',
};

const statusColor: Record<TicketStatus, string> = {
  minted: Colors.success,
  checked_in: Colors.textMuted,
  transferred: Colors.warning,
  listed: Colors.accent,
  invalidated: Colors.error,
};

export const TicketCard = React.memo(function TicketCard({ ticket, onPress }: TicketCardProps) {
  const { onPressIn, onPressOut, animatedStyle: scaleStyle } = useScalePress(0.97);

  return (
    <Animated.View style={[styles.container, scaleStyle]}>
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.inner}
    >
      {/* Left accent bar with gradient effect */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: statusColor[ticket.status] },
        ]}
      />

      <View style={styles.content}>
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={styles.titleArea}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {ticket.event?.title ?? 'Event'}
            </Text>
            <Text style={styles.tierName} numberOfLines={1}>
              {ticket.tier?.name ?? 'General'}
            </Text>
          </View>
          <Badge
            label={formatTicketStatus(ticket.status)}
            variant={statusVariant[ticket.status]}
          />
        </View>

        {/* Divider with ticket stub cutouts */}
        <View style={styles.divider}>
          <View style={styles.dividerCircleLeft} />
          <View style={styles.dividerLine} />
          <View style={styles.dividerCircleRight} />
        </View>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <View style={styles.detail}>
            <Ionicons name="pricetag" size={12} color={Colors.textMuted} />
            <Text style={styles.detailText}>#{ticket.token_id}</Text>
          </View>

          {ticket.event?.start_time && (
            <View style={styles.detail}>
              <Ionicons name="calendar" size={12} color={Colors.textMuted} />
              <Text style={styles.detailText}>{formatDate(ticket.event.start_time)}</Text>
            </View>
          )}

          {ticket.tier?.price_wei && (
            <View style={styles.detail}>
              <Ionicons name="diamond" size={12} color={Colors.primaryLight} />
              <Text style={[styles.detailText, { color: Colors.primaryLight }]}>{formatPrice(ticket.tier.price_wei)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Arrow */}
      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.card,
    marginBottom: Spacing.md,
  },
  inner: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  eventTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  tierName: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dividerCircleLeft: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.background,
    marginLeft: -Spacing.lg - 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  dividerCircleRight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.background,
    marginRight: -Spacing.lg,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  arrow: {
    justifyContent: 'center',
    paddingRight: Spacing.md,
  },
});

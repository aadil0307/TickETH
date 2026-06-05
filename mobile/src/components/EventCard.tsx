import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Badge } from './ui/Badge';
import { useScalePress, useAnimatedProgress } from '../utils/animations';
import { formatDate, hasEventStarted, isEventSoon, formatPrice } from '../utils/format';
import type { TickETHEvent } from '../types';

interface EventCardProps {
  event: TickETHEvent;
  onPress: () => void;
}

export const EventCard = React.memo(function EventCard({ event, onPress }: EventCardProps) {
  const started = hasEventStarted(event.start_time);
  const soon = isEventSoon(event.start_time);
  const { onPressIn, onPressOut, animatedStyle: scaleStyle } = useScalePress(0.97);
  const lowestPrice = event.tiers?.reduce<string | null>((lowest, tier) => {
    if (!lowest) return tier.price_wei;
    return BigInt(tier.price_wei || '0') < BigInt(lowest) ? tier.price_wei : lowest;
  }, null);

  const soldPercent = event.tickets_sold !== undefined && event.total_tickets
    ? Math.min((event.tickets_sold / Math.max(event.total_tickets, 1)) * 100, 100)
    : 0;
  const progressStyle = useAnimatedProgress(soldPercent, 500);

  return (
    <Animated.View style={[styles.container, scaleStyle]}>
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {/* Banner */}
      <View style={styles.bannerWrapper}>
        {event.banner_url ? (
          <Image
            source={{ uri: event.banner_url }}
            style={styles.banner}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]}>
            <Ionicons name="calendar" size={32} color={Colors.textMuted} />
          </View>
        )}

        {/* Status badge overlay */}
        <View style={styles.badgeOverlay}>
          {started ? (
            <Badge label="Live Now" variant="error" size="md" />
          ) : soon ? (
            <Badge label="Starting Soon" variant="warning" size="md" />
          ) : (
            <Badge label="Upcoming" variant="success" />
          )}
        </View>

        {/* Price tag overlay */}
        {lowestPrice && (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>From {formatPrice(lowestPrice)}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
            <Text style={styles.metaText}>{formatDate(event.start_time)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={Colors.primary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {event.venue}
            </Text>
          </View>
        </View>

        {/* Ticket progress */}
        {event.tickets_sold !== undefined && event.total_tickets !== undefined && (
          <View style={styles.ticketInfo}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <View style={styles.ticketMeta}>
              <Text style={styles.ticketCount}>
                {event.tickets_sold}/{event.total_tickets} sold
              </Text>
              {event.total_tickets - event.tickets_sold <= 10 &&
                event.total_tickets - event.tickets_sold > 0 && (
                  <Text style={styles.ticketWarning}>
                    Only {event.total_tickets - event.tickets_sold} left!
                  </Text>
                )}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.card,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerWrapper: {
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: 170,
  },
  bannerPlaceholder: {
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  content: {
    padding: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
    letterSpacing: -0.2,
  },
  meta: {
    gap: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    flex: 1,
  },
  ticketInfo: {
    marginTop: Spacing.md,
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  ticketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketCount: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
  ticketWarning: {
    color: Colors.warning,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  priceTag: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    backgroundColor: 'rgba(8, 8, 15, 0.85)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  priceText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
});

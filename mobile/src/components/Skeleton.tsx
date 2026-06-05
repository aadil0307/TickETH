/**
 * Skeleton loading components with Reanimated shimmer.
 *
 * Provides smooth 60fps shimmer-animated placeholder shapes that match
 * the layout of real content for instant meaningful feedback.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius } from '../constants/theme';
import { useShimmer } from '../utils/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ─── Base shimmer block ────────────────────────────────── */

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonProps) {
  const shimmerStyle = useShimmer();

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.surfaceLight,
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

/* ─── Event card skeleton ───────────────────────────────── */

export function EventCardSkeleton() {
  return (
    <View style={skeletonStyles.eventCard}>
      <Skeleton width="100%" height={160} borderRadius={0} />
      <View style={skeletonStyles.eventContent}>
        <Skeleton width="75%" height={20} />
        <View style={{ height: 8 }} />
        <Skeleton width="50%" height={14} />
        <View style={{ height: 6 }} />
        <Skeleton width="40%" height={14} />
        <View style={{ height: 12 }} />
        <Skeleton width="100%" height={4} borderRadius={2} />
      </View>
    </View>
  );
}

/* ─── Ticket card skeleton ──────────────────────────────── */

export function TicketCardSkeleton() {
  return (
    <View style={skeletonStyles.ticketCard}>
      <View style={skeletonStyles.ticketAccent} />
      <View style={skeletonStyles.ticketContent}>
        <View style={skeletonStyles.ticketRow}>
          <View style={{ flex: 1 }}>
            <Skeleton width="65%" height={16} />
            <View style={{ height: 6 }} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={60} height={22} borderRadius={BorderRadius.full} />
        </View>
        <View style={{ height: 12 }} />
        <View style={skeletonStyles.ticketRow}>
          <Skeleton width={50} height={12} />
          <Skeleton width={70} height={12} />
          <Skeleton width={60} height={12} />
        </View>
      </View>
    </View>
  );
}

/* ─── Event detail skeleton ─────────────────────────────── */

export function EventDetailSkeleton() {
  return (
    <View>
      <Skeleton width="100%" height={240} borderRadius={0} />
      <View style={skeletonStyles.detailContent}>
        <View style={skeletonStyles.detailBadges}>
          <Skeleton width={70} height={24} borderRadius={BorderRadius.full} />
          <Skeleton width={90} height={24} borderRadius={BorderRadius.full} />
        </View>
        <Skeleton width="80%" height={28} />
        <View style={{ height: 20 }} />
        <Skeleton width="60%" height={16} />
        <View style={{ height: 8 }} />
        <Skeleton width="50%" height={16} />
        <View style={{ height: 24 }} />
        <Skeleton width="40%" height={14} />
        <View style={{ height: 12 }} />
        <Skeleton width="100%" height={80} borderRadius={BorderRadius.lg} />
        <View style={{ height: 8 }} />
        <Skeleton width="100%" height={80} borderRadius={BorderRadius.lg} />
      </View>
    </View>
  );
}

/* ─── Profile skeleton ──────────────────────────────────── */

export function ProfileSkeleton() {
  return (
    <View style={skeletonStyles.profileContainer}>
      <View style={skeletonStyles.profileCard}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <View style={{ height: 12 }} />
        <Skeleton width={140} height={20} />
        <View style={{ height: 8 }} />
        <Skeleton width={100} height={24} borderRadius={BorderRadius.full} />
        <View style={{ height: 12 }} />
        <Skeleton width={180} height={32} borderRadius={BorderRadius.full} />
      </View>
      <View style={{ height: 24 }} />
      <Skeleton width={100} height={12} />
      <View style={{ height: 12 }} />
      <Skeleton width="100%" height={160} borderRadius={BorderRadius.lg} />
    </View>
  );
}

/* ─── Listing card skeleton ─────────────────────────────── */

export function ListingCardSkeleton() {
  return (
    <View style={skeletonStyles.listingCard}>
      <View style={skeletonStyles.listingRow}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={16} />
          <View style={{ height: 6 }} />
          <Skeleton width="45%" height={12} />
        </View>
        <Skeleton width={80} height={28} borderRadius={BorderRadius.md} />
      </View>
      <View style={{ height: 8 }} />
      <View style={skeletonStyles.listingRow}>
        <Skeleton width={60} height={12} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

/* ─── Generic list skeleton ─────────────────────────────── */

export function ListSkeleton({
  count = 4,
  ItemSkeleton = EventCardSkeleton,
}: {
  count?: number;
  ItemSkeleton?: React.ComponentType;
}) {
  return (
    <View style={{ paddingHorizontal: Spacing.lg }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: Spacing.md }}>
          <ItemSkeleton />
        </View>
      ))}
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────── */

const skeletonStyles = StyleSheet.create({
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventContent: {
    padding: Spacing.lg,
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ticketAccent: {
    width: 4,
    backgroundColor: Colors.surfaceLight,
  },
  ticketContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailContent: {
    padding: Spacing.xl,
  },
  detailBadges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  profileContainer: {
    padding: Spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

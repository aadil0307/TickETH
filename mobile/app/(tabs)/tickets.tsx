import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { TicketCard } from '../../src/components/TicketCard';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useMyTickets } from '../../src/hooks/useTickets';
import { TicketCardSkeleton } from '../../src/components/Skeleton';
import { analytics } from '../../src/services/analytics';
import { useStaggeredEntrance, useFadeIn } from '../../src/utils/animations';
import type { TicketStatus, Ticket } from '../../src/types';

type Filter = 'all' | TicketStatus;

const FILTERS: { key: Filter; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All' },
  { key: 'minted', label: 'Active', icon: 'ticket-outline' },
  { key: 'checked_in', label: 'Used', icon: 'checkmark-circle-outline' },
  { key: 'listed', label: 'Listed', icon: 'pricetag-outline' },
  { key: 'transferred', label: 'Sent', icon: 'swap-horizontal-outline' },
];

export default function TicketsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const { tickets, loading, error, refresh } = useMyTickets();

  const filtered = useMemo(
    () => (filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)),
    [tickets, filter],
  );

  // Stats
  const activeCount = useMemo(() => tickets.filter((t) => t.status === 'minted').length, [tickets]);
  const checkedInCount = useMemo(
    () => tickets.filter((t) => t.status === 'checked_in').length,
    [tickets],
  );

  useEffect(() => {
    analytics.screenView('my_tickets');
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refresh();
  }, [refresh]);

  const handleFilterChange = useCallback((key: Filter) => {
    Haptics.selectionAsync().catch(() => {});
    setFilter(key);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Ticket; index: number }) => (
      <AnimatedTicketCard
        ticket={item}
        index={index}
        onPress={() => {
          analytics.track('ticket_viewed', { ticketId: item.id, status: item.status });
          router.push(`/ticket/${item.id}`);
        }}
      />
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Animated Header */}
      <View style={styles.header}>
        <AnimatedHeaderText />
        {tickets.length > 0 && (
          <AnimatedStats activeCount={activeCount} checkedInCount={checkedInCount} totalCount={tickets.length} />
        )}
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            onPress={() => handleFilterChange(key)}
            style={[styles.filterPill, filter === key && styles.filterPillActive]}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${label}`}
            accessibilityState={{ selected: filter === key }}
          >
            {icon && (
              <Ionicons
                name={icon}
                size={14}
                color={filter === key ? Colors.textPrimary : Colors.textMuted}
              />
            )}
            <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ticket list */}
      {loading && tickets.length === 0 ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <TicketCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load"
          message={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={loading && tickets.length > 0}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="ticket-outline"
              title={filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`}
              message="Browse events to get your first NFT ticket"
              actionLabel="Browse Events"
              onAction={() => router.push('/(tabs)/events')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

/** Animated header text */
function AnimatedHeaderText() {
  const subtitleStyle = useFadeIn(0);
  const titleStyle = useFadeIn(80);

  return (
    <>
      <Animated.Text style={[styles.subtitle, subtitleStyle]}>Your Collection</Animated.Text>
      <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
        My Tickets
      </Animated.Text>
    </>
  );
}

/** Animated stats row */
function AnimatedStats({ activeCount, checkedInCount, totalCount }: { activeCount: number; checkedInCount: number; totalCount: number }) {
  const statsStyle = useFadeIn(200);

  return (
    <Animated.View style={[styles.statsRow, statsStyle]}>
      <View style={styles.statItem}>
        <Ionicons name="ticket" size={14} color={Colors.primary} />
        <Text style={styles.statText}>{activeCount} active</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
        <Text style={styles.statText}>{checkedInCount} used</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statText}>{totalCount} total</Text>
      </View>
    </Animated.View>
  );
}

/** Reanimated staggered entrance for list items */
function AnimatedTicketCard({
  ticket,
  index,
  onPress,
}: {
  ticket: Ticket;
  index: number;
  onPress: () => void;
}) {
  const animatedStyle = useStaggeredEntrance(index);

  // Expiration indicator — check if event has passed
  const isExpired =
    ticket.event?.start_time && new Date(ticket.event.start_time) < new Date();
  const isTransferred = ticket.status === 'transferred';

  return (
    <Animated.View style={animatedStyle}>
      {(isExpired || isTransferred) && (
        <View style={styles.ticketBadgeRow}>
          {isTransferred && (
            <View style={styles.ticketBadge}>
              <Ionicons name="swap-horizontal" size={10} color={Colors.warning} />
              <Text style={styles.ticketBadgeText}>Transferred</Text>
            </View>
          )}
          {isExpired && !isTransferred && (
            <View style={[styles.ticketBadge, { backgroundColor: 'rgba(107,107,128,0.15)' }]}>
              <Ionicons name="time-outline" size={10} color={Colors.textMuted} />
              <Text style={[styles.ticketBadgeText, { color: Colors.textMuted }]}>
                Event Passed
              </Text>
            </View>
          )}
        </View>
      )}
      <TicketCard ticket={ticket} onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.5,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.extrabold,
    letterSpacing: -0.5,
    marginTop: Spacing['2xs'],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.glass,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.borderActive,
  },
  filterText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  filterTextActive: {
    color: Colors.primary,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
    paddingTop: Spacing.xs,
  },
  ticketBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: 4,
    paddingLeft: Spacing.sm,
  },
  ticketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningMuted,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.15)',
  },
  ticketBadgeText: {
    color: Colors.warning,
    fontSize: Typography.sizes['2xs'],
    fontWeight: Typography.weights.bold,
  },
});

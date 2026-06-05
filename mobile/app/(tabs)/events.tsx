import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { EventCard } from '../../src/components/EventCard';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useEvents } from '../../src/hooks/useEvents';
import { useOfflineStore } from '../../src/stores/offlineStore';
import { EventCardSkeleton } from '../../src/components/Skeleton';
import { analytics } from '../../src/services/analytics';
import { useStaggeredEntrance, useFadeIn } from '../../src/utils/animations';

type SortOption = 'date' | 'price' | 'popularity';
type FilterOption = 'all' | 'upcoming' | 'live' | 'completed';

const SORT_OPTIONS: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'date', label: 'Date', icon: 'calendar-outline' },
  { key: 'price', label: 'Price', icon: 'pricetag-outline' },
  { key: 'popularity', label: 'Popular', icon: 'flame-outline' },
];

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'live', label: 'Live' },
  { key: 'completed', label: 'Completed' },
];

export default function EventsScreen() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const isOnline = useOfflineStore((s) => s.isOnline);

  // Debounce search 300ms
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(text), 300);
  }, []);

  // Build filters for API
  const apiFilters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (debouncedSearch) f.search = debouncedSearch;
    if (filterBy !== 'all') {
      if (filterBy === 'upcoming') f.status = 'published';
      else if (filterBy === 'live') f.status = 'live';
      else if (filterBy === 'completed') f.status = 'completed';
    }
    return Object.keys(f).length > 0 ? f : undefined;
  }, [debouncedSearch, filterBy]);

  const { events, loading, error, hasMore, refresh, loadMore } = useEvents(apiFilters);

  // Sort locally
  const sortedEvents = useMemo(() => {
    const sorted = [...events];
    if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    } else if (sortBy === 'price') {
      sorted.sort((a, b) => {
        const aMin = a.tiers?.reduce((min, t) => {
          const p = BigInt(t.price_wei || '0');
          return p < min ? p : min;
        }, BigInt('999999999999999999999')) ?? BigInt(0);
        const bMin = b.tiers?.reduce((min, t) => {
          const p = BigInt(t.price_wei || '0');
          return p < min ? p : min;
        }, BigInt('999999999999999999999')) ?? BigInt(0);
        return aMin < bMin ? -1 : aMin > bMin ? 1 : 0;
      });
    } else if (sortBy === 'popularity') {
      sorted.sort((a, b) => (b.tickets_sold ?? 0) - (a.tickets_sold ?? 0));
    }
    return sorted;
  }, [events, sortBy]);

  // Card fade-in
  const renderItem = useCallback(
    ({ item, index }: { item: typeof events[0]; index: number }) => (
      <AnimatedEventCard
        event={item}
        index={index}
        onPress={() => {
          analytics.track('event_viewed', { eventId: item.id });
          router.push(`/event/${item.id}`);
        }}
      />
    ),
    [],
  );

  useEffect(() => {
    analytics.screenView('events');
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner} accessible accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={16} color={Colors.warning} />
          <Text style={styles.offlineBannerText}>You are offline. Showing cached data.</Text>
        </View>
      )}

      {/* Animated Header */}
      <AnimatedHeader greeting={greeting()} />

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, venues..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            accessibilityLabel="Search events"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sort & Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {/* Sort options */}
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.pill, sortBy === opt.key && styles.pillActive]}
            onPress={() => setSortBy(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${opt.label}`}
          >
            <Ionicons
              name={opt.icon}
              size={14}
              color={sortBy === opt.key ? Colors.textPrimary : Colors.textMuted}
            />
            <Text style={[styles.pillText, sortBy === opt.key && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.pillDivider} />
        {/* Filter options */}
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.pill, filterBy === opt.key && styles.pillActive]}
            onPress={() => setFilterBy(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${opt.label}`}
          >
            <Text style={[styles.pillText, filterBy === opt.key && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Event list */}
      {loading && events.length === 0 ? (
        <View style={styles.list}>
          {[1, 2, 3, 4].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          message={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={loading && events.length > 0}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No events found"
              message={
                search
                  ? 'Try a different search or filter'
                  : 'Check back later for upcoming events'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

/** Animated header with staggered entrance */
function AnimatedHeader({ greeting }: { greeting: string }) {
  const greetingStyle = useFadeIn(0);
  const titleStyle = useFadeIn(100);

  return (
    <View style={styles.header}>
      <Animated.Text style={[styles.greeting, greetingStyle]}>{greeting}</Animated.Text>
      <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
        Discover Events
      </Animated.Text>
    </View>
  );
}

/** Reanimated staggered entrance for list items */
function AnimatedEventCard({
  event,
  index,
  onPress,
}: {
  event: any;
  index: number;
  onPress: () => void;
}) {
  const animatedStyle = useStaggeredEntrance(index);

  return (
    <Animated.View style={animatedStyle}>
      <EventCard event={event} onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningMuted,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,184,0,0.15)',
  },
  offlineBannerText: {
    color: Colors.warning,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  greeting: {
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
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: 48,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pill: {
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
  pillActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.borderActive,
  },
  pillText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  pillTextActive: {
    color: Colors.primary,
  },
  pillDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
    paddingTop: Spacing.xs,
  },
});

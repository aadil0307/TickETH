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
import { useStaggeredEntrance, useFadeIn } from '../../src/utils/animations';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Badge } from '../../src/components/ui/Badge';
import { ListingCardSkeleton } from '../../src/components/Skeleton';
import { analytics } from '../../src/services/analytics';
import { parseError } from '../../src/services/errorParser';
import { marketplaceApi } from '../../src/api';
import { formatPrice, shortenAddress } from '../../src/utils/format';
import type { Listing } from '../../src/types';

type SortOption = 'newest' | 'price_low' | 'price_high';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_low', label: 'Price: Low' },
  { key: 'price_high', label: 'Price: High' },
];

export default function MarketplaceTabScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    analytics.screenView('marketplace_tab');
    fetchListings();
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketplaceApi.getListings();
      setListings(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const parsed = parseError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  }, [fetchListings]);

  const sorted = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    const arr = [...listings];
    if (sortBy === 'price_low') {
      arr.sort((a, b) => {
        const aP = BigInt(a.price || '0');
        const bP = BigInt(b.price || '0');
        return aP < bP ? -1 : aP > bP ? 1 : 0;
      });
    } else if (sortBy === 'price_high') {
      arr.sort((a, b) => {
        const aP = BigInt(a.price || '0');
        const bP = BigInt(b.price || '0');
        return aP > bP ? -1 : aP < bP ? 1 : 0;
      });
    }
    return arr;
  }, [listings, sortBy]);

  const renderItem = useCallback(
    ({ item, index }: { item: Listing; index: number }) => (
      <AnimatedListingCard
        listing={item}
        index={index}
        onPress={() => {
          analytics.track('listing_viewed', { listingId: item.id });
          router.push(`/marketplace/${item.id}`);
        }}
      />
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Animated.Text style={[styles.subtitle, useFadeIn(0)]}>Buy & Sell</Animated.Text>
          <Animated.Text style={[styles.title, useFadeIn(100)]} accessibilityRole="header">
            Marketplace
          </Animated.Text>
        </View>
        <Animated.View style={useFadeIn(200)}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/marketplace/create');
            }}
            accessibilityLabel="List a ticket for sale"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Sort pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.pill, sortBy === opt.key && styles.pillActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSortBy(opt.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${opt.label}`}
          >
            <Text style={[styles.pillText, sortBy === opt.key && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Listings */}
      {loading && listings.length === 0 ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          message={error}
          actionLabel="Retry"
          onAction={fetchListings}
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="No listings yet"
              message="Be the first to list a ticket for resale"
              actionLabel="List Ticket"
              onAction={() => router.push('/marketplace/create')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function AnimatedListingCard({
  listing,
  index,
  onPress,
}: {
  listing: Listing;
  index: number;
  onPress: () => void;
}) {
  const animatedStyle = useStaggeredEntrance(index);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.listingCard}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Listing: ${listing.ticket?.event?.title ?? 'Ticket'}`}
      >
        <View style={styles.listingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listingEvent} numberOfLines={1}>
              {listing.ticket?.event?.title ?? 'Event'}
            </Text>
            <Text style={styles.listingTier} numberOfLines={1}>
              {listing.ticket?.tier?.name ?? 'General'} · Token #{listing.ticket?.token_id}
            </Text>
          </View>
          <Badge label="For Sale" variant="success" size="sm" />
        </View>

        <View style={styles.listingFooter}>
          <View style={styles.listingPrice}>
            <Ionicons name="diamond-outline" size={14} color={Colors.primary} />
            <Text style={styles.listingPriceText}>{formatPrice(listing.price)}</Text>
          </View>
          <Text style={styles.listingSeller}>
            by {shortenAddress(listing.seller_wallet)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
    paddingTop: Spacing.xs,
  },
  listingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  listingEvent: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  listingTier: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listingPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  listingPriceText: {
    color: Colors.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  listingSeller: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
});

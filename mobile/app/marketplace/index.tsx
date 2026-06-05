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
import { useStaggeredEntrance, useScalePress } from '../../src/utils/animations';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header } from '../../src/components/ui/Header';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Badge } from '../../src/components/ui/Badge';
import { ListingCardSkeleton } from '../../src/components/Skeleton';
import { analytics } from '../../src/services/analytics';
import { showToast } from '../../src/services/toast';
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

export default function MarketplaceBrowseScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    analytics.screenView('marketplace');
    fetchListings();
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketplaceApi.getListings();
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    fetchListings();
  }, [fetchListings]);

  const sorted = useMemo(() => {
    if (!Array.isArray(listings) || listings.length === 0) return [];
    const copy = listings.slice();
    if (sortBy === 'price_low') {
      copy.sort((a, b) => {
        const ap = BigInt(a.price);
        const bp = BigInt(b.price);
        return ap < bp ? -1 : ap > bp ? 1 : 0;
      });
    } else if (sortBy === 'price_high') {
      copy.sort((a, b) => {
        const ap = BigInt(a.price);
        const bp = BigInt(b.price);
        return ap > bp ? -1 : ap < bp ? 1 : 0;
      });
    } else {
      copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return copy;
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
      <Header
        title="Marketplace"
        leftIcon="arrow-back"
        onLeftPress={() => router.back()}
        rightIcon="add-circle"
        onRightPress={() => router.push('/marketplace/create')}
      />

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
        <View style={styles.statsChip}>
          <Text style={styles.statsChipText}>{listings.length} listings</Text>
        </View>
      </ScrollView>

      {/* Listings */}
      {loading && listings.length === 0 ? (
        <View style={styles.list}>
          {[1, 2, 3, 4].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load"
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
              actionLabel="Create Listing"
              onAction={() => router.push('/marketplace/create')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

/** Animated listing card with staggered entrance */
function AnimatedListingCard({
  listing,
  index,
  onPress,
}: {
  listing: Listing;
  index: number;
  onPress: () => void;
}) {
  const entranceStyle = useStaggeredEntrance(index);
  const { animatedStyle, onPressIn, onPressOut } = useScalePress(0.97);

  return (
    <Animated.View style={[entranceStyle, animatedStyle]}>
      <TouchableOpacity
        style={styles.listingCard}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
        accessibilityLabel={`Listing: ${listing.ticket?.event?.title ?? 'Ticket'}, price ${formatPrice(listing.price)}`}
        accessibilityRole="button"
      >
        <View style={styles.listingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {listing.ticket?.event?.title ?? 'Ticket'}
            </Text>
            <Text style={styles.listingTier}>
              {listing.ticket?.tier?.name ?? 'General'} • #{listing.ticket?.token_id ?? '?'}
            </Text>
          </View>
          <Badge label={listing.status} variant={listing.status === 'active' ? 'success' : 'default'} size="sm" />
        </View>
        <View style={styles.listingFooter}>
          <View style={styles.listingSellerRow}>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.listingSeller}>{shortenAddress(listing.seller_wallet)}</Text>
          </View>
          <Text style={styles.listingPrice}>{formatPrice(listing.price)}</Text>
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
  createButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
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
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  pillTextActive: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  statsChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statsChipText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
  },
  listingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  listingTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  listingTier: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: 3,
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listingSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.glass,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  listingSeller: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontFamily: 'monospace',
  },
  listingPrice: {
    color: Colors.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.extrabold,
  },
});

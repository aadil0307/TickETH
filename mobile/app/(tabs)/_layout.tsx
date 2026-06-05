import React, { useEffect, useRef, useCallback } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text, StyleSheet, BackHandler, ToastAndroid } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Typography, Layout, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useOfflineStore } from '../../src/stores/offlineStore';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { SpringPresets } from '../../src/utils/animations';

/** Animated tab icon with scale bounce on focus change */
function AnimatedTabIcon({
  name,
  outlineName,
  size = 24,
  color,
  focused,
  badgeCount,
}: {
  name: string;
  outlineName: string;
  size?: number;
  color: string;
  focused: boolean;
  badgeCount?: number;
}) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, SpringPresets.bouncy);
    bgOpacity.value = withSpring(focused ? 1 : 0, SpringPresets.snappy);
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  return (
    <View style={tabIconStyles.wrapper}>
      <Animated.View style={[tabIconStyles.bg, bgStyle]} />
      <Animated.View style={iconStyle}>
        <Ionicons
          name={(focused ? name : outlineName) as any}
          size={size}
          color={color}
        />
      </Animated.View>
      {(badgeCount ?? 0) > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 32,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.lg,
  },
});

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const pendingCount = useOfflineStore((s) => s.pendingScans.length);
  const lastBackPress = useRef(0);

  // Android back button: "press again to exit" on tab screens
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        return false; // allow exit on double press
      }
      lastBackPress.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true; // prevent default (don't exit)
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, []);

  if (!hydrated) {
    return <LoadingSpinner fullScreen message="Loading TickETH..." />;
  }
  if (!user) {
    return <Redirect href="/auth" />;
  }

  const isVolunteerRole = ['volunteer', 'admin', 'organizer'].includes(user.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          height: Layout.tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            android: {
              elevation: 12,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: Typography.sizes['2xs'],
          fontWeight: Typography.weights.semibold,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          gap: 2,
        },
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="compass"
              outlineName="compass-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="ticket"
              outlineName="ticket-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="storefront"
              outlineName="storefront-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="scan-circle"
              outlineName="scan-circle-outline"
              size={26}
              color={color}
              focused={focused}
              badgeCount={pendingCount}
            />
          ),
          href: isVolunteerRole ? '/(tabs)/scanner' : null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="person-circle"
              outlineName="person-circle-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: Colors.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
});

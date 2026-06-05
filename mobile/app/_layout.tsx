import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThirdwebProvider } from 'thirdweb/react-native';
import { AuthProvider } from '../src/providers/AuthProvider';
import { WalletProvider } from '../src/providers/WalletProvider';
import { CheckinProvider } from '../src/providers/CheckinProvider';
import { ToastProvider } from '../src/services/toast';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { Colors } from '../src/constants/theme';

// Prevent splash screen from hiding immediately
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash after a short delay
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
      <SafeAreaProvider>
        <ThirdwebProvider>
          <AuthProvider>
            <WalletProvider>
              <CheckinProvider>
                <ToastProvider>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.background },
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="event/[id]"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="ticket/[id]"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="transfer/[id]"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="checkin-confirm"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="edit-profile"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="marketplace/index"
                    options={{ headerShown: false, animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="marketplace/create"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="marketplace/[id]"
                    options={{ headerShown: false, animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen
                    name="settings"
                    options={{ headerShown: false, animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="faq"
                    options={{ headerShown: false, animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="help-support"
                    options={{ headerShown: false, animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="terms"
                    options={{ headerShown: false, animation: 'slide_from_right' }}
                  />
                </Stack>
              </ToastProvider>
              </CheckinProvider>
            </WalletProvider>
          </AuthProvider>
        </ThirdwebProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

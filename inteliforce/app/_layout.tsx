// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { initNotifications } from '@/lib/notifications';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { registerBackgroundSync } from '@/lib/offline/sync';
import { useTheme } from '@/hooks/useTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutos
    },
  },
});

export default function RootLayout() {
  const { user, isHydrated, hydrate } = useAuth();
  const { colors: activeColors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      await hydrate();
      await initNotifications();
      await registerBackgroundSync();
      setAppReady(true);
    }
    prepare();
  }, [hydrate]);

  // Auth gate navigation
  useEffect(() => {
    if (!appReady || !isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (inAuthGroup) {
        if (user.rol === 'merchandiser') {
          router.replace('/(merchandiser)');
        } else {
          router.replace('/(vendedor)');
        }
      }
    }
  }, [user, isHydrated, appReady, segments, router]);

  if (!appReady || !isHydrated) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: activeColors.background }]}>
        <ActivityIndicator size="large" color={activeColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: activeColors.background }]} edges={['top']}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: activeColors.background } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(vendedor)" />
            <Stack.Screen name="(merchandiser)" />
          </Stack>
        </SafeAreaView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

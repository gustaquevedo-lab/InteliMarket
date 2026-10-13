// app/(merchandiser)/index.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { VisitCard, RouteStop } from '@/components/visita/VisitCard';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';

export default function MerchandiserDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useTheme();

  const {
    data: routes = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<RouteStop[]>({
    queryKey: ['merchandiser-routes-today'],
    queryFn: async () => {
      try {
        const stops = await api.get<RouteStop[]>('/me/routes/today');
        const visits = await api.get<any[]>('/visits/today').catch(() => []);
        const visitMap = new Map(visits.map((v) => [v.customer_id, v.estado]));

        return stops.map((s) => ({
          ...s,
          estado: (visitMap.get(s.customer_id) || 'pendiente') as any,
        }));
      } catch {
        return [];
      }
    },
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const completed = routes.filter((r) => r.estado === 'cerrada').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.greetingText, { color: theme.text }]}>
            Hola, {user?.nombre?.split(' ')[0] || 'Merchandiser'}
          </Text>
          <Text style={[styles.roleSubtext, { color: theme.textSecondary }]}>Puntos de Venta a Auditar</Text>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: isDark ? '#1E293B' : '#EAEDFF',
                borderColor: theme.border,
              },
            ]}
            activeOpacity={0.8}
            accessibilityLabel="Cambiar tema claro/oscuro"
          >
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={16} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={logout}
            style={[
              styles.logoutBtn,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: theme.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Stats Card */}
      <View style={styles.heroBox}>
        <Card
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#0F1F3D',
              borderColor: isDark ? '#334155' : 'transparent',
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <View style={styles.heroRow}>
            <View style={[styles.heroIconBox, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={22} color={isDark ? '#002109' : '#FFFFFF'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Progreso de Auditoría</Text>
              <Text style={styles.heroStats}>
                {completed} de {routes.length} locales visitados
              </Text>
            </View>
            <View
              style={[
                styles.pctBadge,
                {
                  backgroundColor: isDark ? '#131F37' : '#1E293B',
                  borderColor: isDark ? '#334155' : '#334155',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.pctText, { color: theme.primary }]}>
                {routes.length > 0 ? Math.round((completed / routes.length) * 100) : 0}%
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* List Header */}
      <View style={styles.listHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Ruta de Merchandising ({routes.length})
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="storefront-outline" size={44} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin locales asignados</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            No tienes auditorías asignadas para el día de hoy.
          </Text>
        </View>
      ) : (
        <FlashList
          data={routes}
          keyExtractor={(item) => item.customer_id}
          renderItem={({ item }) => (
            <VisitCard
              stop={item}
              onPress={() =>
                router.push({
                  pathname: '/(merchandiser)/visita/[id]',
                  params: { id: item.customer_id, razon_social: item.razon_social },
                })
              }
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[theme.primary]} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '800',
  },
  roleSubtext: {
    fontSize: 13,
    fontWeight: '500',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  heroBox: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  heroStats: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  pctBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pctText: {
    fontSize: 14,
    fontWeight: '800',
  },
  listHeader: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});

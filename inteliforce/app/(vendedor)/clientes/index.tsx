// app/(vendedor)/clientes/index.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';

interface RouteStopItem {
  customer_id: string;
  razon_social: string;
  direccion?: string;
  telefono?: string;
  orden_visita: number;
}

export default function VendedorClientesListScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [search, setSearch] = useState('');

  const { data: customers = [], isLoading } = useQuery<RouteStopItem[]>({
    queryKey: ['vendedor-all-customers'],
    queryFn: async () => {
      return await api.get<RouteStopItem[]>('/me/routes/today');
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(q) ||
        (c.direccion && c.direccion.toLowerCase().includes(q))
    );
  }, [customers, search]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.headerBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Cartera de Clientes</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{customers.length} clientes asignados</Text>
      </View>

      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: isDark ? theme.cardLow : '#FFFFFF',
            borderColor: theme.border,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Buscar por nombre o dirección..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.customer_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/(vendedor)/clientes/[id]',
                  params: { id: item.customer_id, razon_social: item.razon_social },
                })
              }
              activeOpacity={0.8}
            >
              <Card style={styles.clientCard}>
                <View style={styles.clientRow}>
                  <View style={[styles.avatar, { backgroundColor: isDark ? '#151C25' : '#EFF6FF' }]}>
                    <Ionicons name="person" size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: theme.text }]}>{item.razon_social}</Text>
                    {item.direccion && (
                      <Text style={[styles.clientAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                        {item.direccion}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientCard: {
    padding: 14,
    marginBottom: 8,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  clientAddress: {
    fontSize: 12,
    marginTop: 2,
  },
});

// app/(merchandiser)/lotes/[customerId].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LoteRow, LotItem } from '@/components/merchandiser/LoteRow';
import { api } from '@/lib/api';
import { colors } from '@/constants/colors';

export default function CustomerLotsScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const router = useRouter();

  const { data: lots = [], isLoading } = useQuery<LotItem[]>({
    queryKey: ['customer-lots-page', customerId],
    queryFn: async () => {
      return await api.get<LotItem[]>(`/customers/${customerId}/lot-expiry`);
    },
    enabled: Boolean(customerId),
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lotes y Vencimientos</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {lots.length > 0 ? (
            lots.map((lot) => <LoteRow key={lot.id} lot={lot} />)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="barcode-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No hay lotes registrados para este cliente.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});

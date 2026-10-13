// components/ui/OfflineBanner.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';

export function OfflineBanner() {
  const { isConnected, pendingCount, isSyncing, triggerSync } = useOfflineQueue();
  const { theme, isDark } = useTheme();

  if (isConnected && pendingCount === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        !isConnected
          ? {
              backgroundColor: isDark ? '#422006' : '#FEF9C3',
              borderBottomColor: isDark ? '#713F12' : '#FDE047',
            }
          : {
              backgroundColor: isDark ? '#151C25' : '#EFF6FF',
              borderBottomColor: isDark ? '#232A34' : '#BFDBFE',
            },
      ]}
    >
      <View style={styles.leftContent}>
        <Ionicons
          name={!isConnected ? 'cloud-offline-outline' : 'sync-outline'}
          size={18}
          color={
            !isConnected
              ? (isDark ? '#FDE047' : '#854D0E')
              : theme.primary
          }
        />
        <Text
          style={[
            styles.text,
            {
              color: !isConnected
                ? (isDark ? '#FEF08A' : '#854D0E')
                : (isDark ? '#E2E8F0' : theme.text),
            },
          ]}
        >
          {!isConnected
            ? 'Modo sin conexión — Las acciones se guardan localmente'
            : `${pendingCount} acción${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar`}
        </Text>
      </View>

      {isConnected && pendingCount > 0 && (
        <TouchableOpacity
          style={[
            styles.syncButton,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: theme.border,
            },
          ]}
          onPress={triggerSync}
          disabled={isSyncing}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.syncButtonText, { color: theme.primary }]}>Sincronizar</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  syncButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  syncButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// components/gps/LocationBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface LocationBadgeProps {
  accuracy: number;
  isLocating?: boolean;
}

export function LocationBadge({ accuracy, isLocating }: LocationBadgeProps) {
  const { theme, isDark } = useTheme();

  const getStatus = () => {
    if (isLocating) {
      return {
        label: 'Buscando GPS...',
        color: theme.primary,
        bg: isDark ? '#151C25' : '#EFF6FF',
        icon: 'location-outline' as const,
      };
    }
    if (accuracy <= 30) {
      return {
        label: `GPS Óptimo • ±${Math.round(accuracy)}m`,
        color: theme.success,
        bg: isDark ? '#004B1E' : theme.successLight,
        icon: 'checkmark-circle' as const,
      };
    }
    if (accuracy <= 60) {
      return {
        label: `GPS Bueno • ±${Math.round(accuracy)}m`,
        color: theme.warning,
        bg: isDark ? '#451A03' : theme.warningLight,
        icon: 'alert-circle' as const,
      };
    }
    return {
      label: `GPS Impreciso • ±${Math.round(accuracy)}m`,
      color: theme.danger,
      bg: isDark ? '#450A0A' : theme.dangerLight,
      icon: 'warning' as const,
    };
  };

  const st = getStatus();

  return (
    <View style={[styles.badge, { backgroundColor: st.bg }]}>
      <Ionicons name={st.icon} size={14} color={st.color} style={styles.icon} />
      <Text style={[styles.text, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});

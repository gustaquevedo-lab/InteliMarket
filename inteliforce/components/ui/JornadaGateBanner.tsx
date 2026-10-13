// components/ui/JornadaGateBanner.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { haptic } from '@/lib/haptics';

interface JornadaGateBannerProps {
  style?: any;
}

export function JornadaGateBanner({ style }: JornadaGateBannerProps) {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    haptic.medium();
    router.push('/(vendedor)/asistencia');
  };

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
          borderColor: isDark ? '#D97706' : '#FCD34D',
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? '#78350F' : '#FEF3C7' }]}>
          <Ionicons name="lock-closed" size={18} color="#D97706" />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: isDark ? '#FDE68A' : '#92400E' }]}>
            Jornada de Campo No Iniciada
          </Text>
          <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#78350F' }]}>
            Debes registrar tu entrada en Asistencia para habilitar el ruteo, check-in GPS y la toma de pedidos.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.actionBtn,
          {
            backgroundColor: '#D97706',
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <Ionicons name="time" size={16} color="#FFFFFF" />
        <Text style={styles.actionBtnText}>Marcar Entrada Ahora</Text>
        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  actionBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    gap: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

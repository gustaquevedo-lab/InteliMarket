// components/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'dark';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Badge({
  label,
  variant = 'primary',
  style,
  textStyle,
  icon,
}: BadgeProps) {
  const { theme, isDark } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: isDark ? '#004B1E' : theme.successLight,
          text: isDark ? '#4BE277' : theme.success,
        };
      case 'warning':
        return {
          bg: isDark ? '#451A03' : theme.warningLight,
          text: isDark ? '#FBBF24' : theme.warning,
        };
      case 'danger':
        return {
          bg: isDark ? '#450A0A' : theme.dangerLight,
          text: isDark ? '#FFB4AB' : theme.danger,
        };
      case 'info':
        return {
          bg: isDark ? '#172554' : theme.infoLight,
          text: isDark ? '#93C5FD' : theme.info,
        };
      case 'neutral':
        return {
          bg: isDark ? '#1F2937' : '#F1F5F9',
          text: isDark ? '#9CA3AF' : theme.textSecondary,
        };
      case 'dark':
        return {
          bg: isDark ? '#0F172A' : '#1E293B',
          text: '#FFFFFF',
        };
      default:
        return {
          bg: isDark ? '#004B1E' : '#DCFCE7',
          text: theme.primary,
        };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color: c.text }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});

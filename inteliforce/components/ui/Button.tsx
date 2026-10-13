// components/ui/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { theme, isDark } = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return isDark ? '#1F2937' : theme.border;
    switch (variant) {
      case 'primary':
        return theme.primary;
      case 'secondary':
        return theme.secondary;
      case 'success':
        return theme.success;
      case 'warning':
        return theme.warning;
      case 'danger':
        return theme.danger;
      case 'outline':
      case 'ghost':
        return 'transparent';
      default:
        return theme.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.textMuted;
    switch (variant) {
      case 'outline':
        return theme.primary;
      case 'ghost':
        return theme.textSecondary;
      case 'primary':
        // High contrast on primary in dark mode (black text on neon green), white on dark green
        return isDark ? '#002109' : '#FFFFFF';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[size],
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && {
          borderWidth: 1.5,
          borderColor: disabled ? (isDark ? '#1F2937' : theme.border) : theme.primary,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? theme.primary : (isDark ? '#002109' : '#FFFFFF')}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.text, styles[`${size}Text`], { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
  sm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  smText: {
    fontSize: 13,
  },
  mdText: {
    fontSize: 15,
  },
  lgText: {
    fontSize: 17,
  },
});

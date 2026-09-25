// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InteliforceLogo } from '@/components/ui/InteliforceLogo';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { config } from '@/constants/config';
import { haptic } from '@/lib/haptics';

export default function LoginScreen() {
  const { login } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  const [cedula, setCedula] = useState('');
  const [pin, setPin] = useState('');
  const [companyId, setCompanyId] = useState(config.companyId);
  const [loading, setLoading] = useState(false);

  // Modo primer uso: configurar PIN con Service Key
  const [isFirstUse, setIsFirstUse] = useState(false);
  const [serviceKey, setServiceKey] = useState('');

  const handleLogin = async () => {
    if (!cedula.trim()) {
      Alert.alert('Cédula requerida', 'Por favor ingresa tu número de cédula.');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('PIN inválido', 'El PIN debe ser exactamente de 4 dígitos.');
      return;
    }
    if (!companyId.trim()) {
      Alert.alert('Empresa requerida', 'Por favor ingresa el identificador de la empresa.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{
        access_token: string;
        sales_rep_id: string;
        nombre: string;
        rol: string;
        company_id?: string;
      }>('/auth/login', {
        cedula: cedula.trim(),
        pin: pin.trim(),
        company_id: companyId.trim(),
      });

      if (res.access_token) {
        haptic.success();
        await login(res.access_token, {
          id: res.sales_rep_id,
          sales_rep_id: res.sales_rep_id,
          nombre: res.nombre,
          rol: res.rol,
          company_id: companyId.trim(),
          cedula: cedula.trim(),
        });
      }
    } catch (err: any) {
      haptic.error();
      Alert.alert(
        'Error de ingreso',
        err?.data?.detail || err?.message || 'Credenciales inválidas o PIN no configurado'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapPin = async () => {
    if (!cedula.trim() || !serviceKey.trim() || pin.length !== 4) {
      haptic.warning();
      Alert.alert('Datos incompletos', 'Completa tu cédula, la clave de supervisor y tu nuevo PIN de 4 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/set-pin', {
        cedula: cedula.trim(),
        api_key: serviceKey.trim(),
        pin: pin.trim(),
      });
      haptic.success();
      Alert.alert('PIN configurado', 'Tu PIN fue establecido exitosamente. Ya puedes iniciar sesión.');
      setIsFirstUse(false);
    } catch (err: any) {
      haptic.error();
      Alert.alert('Error al configurar PIN', err?.data?.detail || err?.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardContainer, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Quick Theme Switch in Auth Header */}
      <View style={styles.topThemeRow}>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[
            styles.themeToggleBtn,
            { backgroundColor: isDark ? '#151C25' : '#EAEDFF', borderColor: theme.border },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name={isDark ? 'sunny' : 'moon'} size={16} color={theme.primary} />
          <Text style={[styles.themeToggleText, { color: theme.textSecondary }]}>
            {isDark ? 'Modo Oscuro' : 'Modo Claro'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo & Header */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <InteliforceLogo size={84} />
          </View>
          <Text style={[styles.appName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            Inteliforce
          </Text>
          <Text style={[styles.appTagline, { color: theme.textSecondary }]}>
            Fuerza de Venta y Distribución en Campo
          </Text>
        </View>

        {/* Card Formulario */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.formTitle, { color: theme.text }]}>
            {isFirstUse ? 'Configurar PIN Inicial' : 'Iniciar Sesión'}
          </Text>
          <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>
            {isFirstUse
              ? 'Ingresa la clave maestra provista por tu supervisor y define tu PIN'
              : 'Ingresa con tu documento de identidad y tu PIN personal'}
          </Text>

          <Input
            label="Número de Cédula"
            placeholder="Ej: 4123456"
            value={cedula}
            onChangeText={setCedula}
            keyboardType="numeric"
            leftIcon={<Ionicons name="card-outline" size={20} color={theme.textSecondary} />}
          />

          {isFirstUse && (
            <Input
              label="Clave de Activación (Service Key)"
              placeholder="ifs_..."
              value={serviceKey}
              onChangeText={setServiceKey}
              autoCapitalize="none"
              leftIcon={<Ionicons name="key-outline" size={20} color={theme.textSecondary} />}
            />
          )}

          <Input
            label={isFirstUse ? 'Nuevo PIN (4 dígitos)' : 'PIN (4 dígitos)'}
            placeholder="••••"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />}
          />

          <Button
            title={
              loading
                ? 'Verificando...'
                : isFirstUse
                ? 'Guardar PIN y Activar'
                : 'Acceder a mi Ruta'
            }
            onPress={isFirstUse ? handleBootstrapPin : handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginButton}
            icon={<Ionicons name="shield-checkmark" size={18} color={isDark ? '#002109' : '#FFFFFF'} />}
          />

          <TouchableOpacity
            style={styles.toggleModeBtn}
            onPress={() => setIsFirstUse(!isFirstUse)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleModeText, { color: theme.primary }]}>
              {isFirstUse ? '← Volver a inicio de sesión con PIN' : '¿Primer uso? Configurar mi PIN con clave de supervisor'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerNote}>
          <Ionicons name="cloud-done-outline" size={16} color={theme.textMuted} />
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            100% Funcional sin conexión • Sincronización Automática
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  topThemeRow: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    marginBottom: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  appTagline: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  loginButton: {
    marginTop: 12,
  },
  toggleModeBtn: {
    marginTop: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleModeText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
  },
});

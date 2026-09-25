// components/gps/CheckinButton.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { LocationBadge } from './LocationBadge';
import { useLocation } from '@/hooks/useLocation';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';

interface CheckinButtonProps {
  customerId: string;
  customerName: string;
  onCheckinSuccess: (visitId: string) => void;
}

export function CheckinButton({ customerId, customerName, onCheckinSuccess }: CheckinButtonProps) {
  const { location, accuracy, isLocating, requestFix, isGoodAccuracy } = useLocation();
  const { enqueueOrExecute } = useOfflineQueue();
  const { theme, isDark } = useTheme();

  const [loading, setLoading] = useState(false);
  const [outOfRangeData, setOutOfRangeData] = useState<{
    distancia_m: number;
    umbral_m: number;
  } | null>(null);

  const performCheckin = async (forceReport = false) => {
    if (forceReport) {
      haptic.medium();
    } else {
      haptic.light();
    }
    setLoading(true);
    try {
      // Obtener lectura fresca si no la tenemos
      const loc = location || (await requestFix());
      const lat = loc?.latitude ?? 0;
      const lng = loc?.longitude ?? 0;
      const acc = loc?.accuracy ?? 999;

      const payload = {
        customer_id: customerId,
        lat,
        lng,
        accuracy: acc,
        offline_at: new Date().toISOString(),
        ...(forceReport ? { notas: 'Check-in forzado fuera de rango por vendedor' } : {}),
      };

      const result = await enqueueOrExecute('checkin', payload, async () => {
        try {
          return await api.post<{ ok: boolean; visit_id: string }>('/visits', payload);
        } catch (err: any) {
          if (err?.status === 422 && err?.data?.error === 'fuera_de_rango') {
            haptic.warning();
            setOutOfRangeData({
              distancia_m: err.data.distancia_m,
              umbral_m: err.data.umbral_m,
            });
            throw err;
          }
          throw err;
        }
      });

      setOutOfRangeData(null);
      haptic.success();
      const generatedVisitId = result.data?.visit_id || `offline_visit_${Date.now()}`;
      onCheckinSuccess(generatedVisitId);
    } catch (err: any) {
      if (err?.status !== 422) {
        // En caso de fallo de red imprevisto, la cola ya lo guardó o reportó error
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LocationBadge accuracy={accuracy} isLocating={isLocating} />

      {!isGoodAccuracy && (
        <Text style={[styles.accuracyWarning, { color: theme.warning }]}>
          Precisión GPS baja (±{Math.round(accuracy)}m). Espera unos segundos para mejor señal.
        </Text>
      )}

      <Button
        title={loading ? 'Verificando Ubicación...' : `Registrar Llegada (${customerName})`}
        variant="primary"
        size="lg"
        loading={loading}
        onPress={() => performCheckin(false)}
        icon={<Ionicons name="location" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
        style={styles.checkinButton}
      />

      {/* Modal 422: Fuera de Rango */}
      <Modal visible={!!outOfRangeData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: isDark ? '#451A03' : theme.warningLight },
              ]}
            >
              <Ionicons name="navigate-circle" size={38} color={theme.warning} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Ubicación Fuera de Rango</Text>

            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              Estás a {Math.round(outOfRangeData?.distancia_m || 0)}m del cliente (el límite es{' '}
              {Math.round(outOfRangeData?.umbral_m || 0)}m).
              {'\n\n'}
              Si estás efectivamente en el local, puedes reportar tu llegada y se registrará
              para verificación del supervisor.
            </Text>

            <View style={styles.modalActions}>
              <Button
                title="Reportar Igualmente"
                variant="warning"
                size="md"
                loading={loading}
                onPress={() => {
                  setOutOfRangeData(null);
                  performCheckin(true);
                }}
                style={{ marginBottom: 8 }}
              />
              <Button
                title="Cancelar"
                variant="outline"
                size="md"
                onPress={() => setOutOfRangeData(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  accuracyWarning: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  checkinButton: {
    width: '100%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    width: '100%',
  },
});

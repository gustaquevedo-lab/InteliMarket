// hooks/useAttendanceGuard.ts
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';

export interface AttendanceTodayData {
  estado_jornada: 'sin_marcar' | 'en_jornada' | 'en_pausa' | 'jornada_cerrada';
  hora_entrada?: string | null;
  hora_salida?: string | null;
  minutos_trabajados?: number;
}

export function useAttendanceGuard() {
  const router = useRouter();

  const {
    data: attendance,
    isLoading: loadingAttendance,
    refetch: refetchAttendance,
  } = useQuery<AttendanceTodayData | null>({
    queryKey: ['attendance-today'],
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => {
      try {
        return await api.get<AttendanceTodayData>('/attendance/today');
      } catch {
        return null;
      }
    },
  });

  const estadoJornada = attendance?.estado_jornada || 'sin_marcar';
  const isJornadaActiva = estadoJornada === 'en_jornada';

  /**
   * Envuelve una acción comercial (iniciar visita, tomar pedido, registrar cobro)
   * Si la jornada no está activa, bloquea la acción, emite feedback háptico de advertencia
   * y ofrece ir directamente a la pantalla de Asistencia para marcar entrada.
   */
  const guardAction = useCallback(
    (action: () => void, customMessage?: string) => {
      if (isJornadaActiva) {
        action();
      } else {
        haptic.warning();
        Alert.alert(
          'Jornada no iniciada',
          customMessage ||
            'Debes registrar tu entrada en Asistencia antes de iniciar visitas, tomar pedidos o registrar operaciones de campo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Marcar Entrada',
              style: 'default',
              onPress: () => {
                router.push('/(vendedor)/asistencia');
              },
            },
          ]
        );
      }
    },
    [isJornadaActiva, router]
  );

  return {
    attendance,
    estadoJornada,
    isJornadaActiva,
    loadingAttendance,
    refetchAttendance,
    guardAction,
  };
}

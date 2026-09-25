// app/(vendedor)/asistencia.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useLocation } from '@/hooks/useLocation';
import { api } from '@/lib/api';

interface AttendanceTodayData {
  estado_jornada: 'sin_marcar' | 'en_jornada' | 'en_pausa' | 'jornada_cerrada';
  hora_entrada?: string | null;
  hora_salida?: string | null;
  minutos_trabajados: number;
  marcaciones: Array<{
    id: string;
    tipo: string;
    hora: string;
    recorded_at: string;
    coords?: { lat: number; lng: number; accuracy: number };
    foto_url?: string;
    notas?: string;
  }>;
  colaborador: {
    nombre: string;
    cedula: string;
    cargo: string;
    departamento: string;
    empresa: string;
    salario?: number;
    sueldok_sync: boolean;
    horario?: string;
  };
  metricas_empresa?: {
    totalEmployees?: number;
    presentToday?: number;
    lateToday?: number;
    absentToday?: number;
    attendanceRate?: number;
  };
}

interface TeamMember {
  id: string;
  nombre: string;
  ci: string;
  cargo: string;
  depto: string;
  estado: string;
  hoy: string;
  entrada?: string | null;
  salida?: string | null;
  status: string;
  checkInPhotoUrl?: string | null;
}

interface TeamData {
  colaboradores: TeamMember[];
  metricas: {
    totalEmployees?: number;
    presentToday?: number;
    lateToday?: number;
    absentToday?: number;
    attendanceRate?: number;
  };
  empresa: {
    name?: string;
    ruc?: string;
    workStartTime?: string;
    workEndTime?: string;
  };
}

export default function AsistenciaScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const { location, accuracy, requestFix, isLocating } = useLocation();

  const [activeTab, setActiveTab] = useState<'mi_jornada' | 'equipo'>('mi_jornada');
  const [teamSearch, setTeamSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Reloj digital en vivo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Consultar estado de jornada de hoy
  const {
    data: attendance,
    isLoading: isLoadingAttendance,
    refetch: refetchAttendance,
    isRefetching,
  } = useQuery<AttendanceTodayData>({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      return await api.get<AttendanceTodayData>('/attendance/today');
    },
    refetchInterval: 30000,
  });

  // Consultar equipo de campo desde SueldOK
  const {
    data: teamData,
    isLoading: isLoadingTeam,
    refetch: refetchTeam,
  } = useQuery<TeamData>({
    queryKey: ['attendance-team'],
    queryFn: async () => {
      return await api.get<TeamData>('/attendance/team');
    },
    enabled: activeTab === 'equipo',
  });

  // Mutación para registrar punch
  const punchMutation = useMutation({
    mutationFn: async (tipo: 'entrada' | 'salida' | 'almuerzo_inicio' | 'almuerzo_fin') => {
      const loc = location || (await requestFix());
      return await api.post<any>('/attendance/punch', {
        tipo,
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        accuracy: loc?.accuracy ?? null,
        battery_level: 0.95,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-team'] });
      Alert.alert('¡Marcación Registrada!', res.mensaje || 'Tu registro se guardó con éxito en SueldOK.');
    },
    onError: (err: any) => {
      Alert.alert('Error al marcar', err?.message || 'No se pudo comunicar con el servidor.');
    },
  });

  const estado = attendance?.estado_jornada || 'sin_marcar';

  const isSupervisor = useMemo(() => {
    const cargo = (attendance?.colaborador?.cargo || '').toUpperCase();
    return cargo.includes('SUPERVISOR') || cargo.includes('GERENTE') || cargo.includes('JEFE');
  }, [attendance?.colaborador?.cargo]);

  const estadoBadge = useMemo(() => {
    switch (estado) {
      case 'en_jornada':
        return { label: 'EN JORNADA ACTIVA', color: '#10B981', bg: isDark ? '#064E3B' : '#D1FAE5' };
      case 'en_pausa':
        return { label: 'EN PAUSA ALMUERZO', color: '#F59E0B', bg: isDark ? '#78350F' : '#FEF3C7' };
      case 'jornada_cerrada':
        return { label: 'JORNADA FINALIZADA', color: '#38BDF8', bg: isDark ? '#0C4A6E' : '#E0F2FE' };
      default:
        return { label: 'SIN MARCAR HOY', color: '#EF4444', bg: isDark ? '#7F1D1D' : '#FEE2E2' };
    }
  }, [estado, isDark]);

  const timeFormatted = currentTime.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateFormatted = currentTime.toLocaleDateString('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const horasTrabajadas = useMemo(() => {
    const min = attendance?.minutos_trabajados || 0;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  }, [attendance?.minutos_trabajados]);

  const filteredTeam = useMemo(() => {
    const list = teamData?.colaboradores || [];
    if (!teamSearch.trim()) return list;
    const q = teamSearch.toLowerCase();
    return list.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.cargo.toLowerCase().includes(q) ||
        m.ci.includes(q)
    );
  }, [teamData?.colaboradores, teamSearch]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? '#0F172A' : '#012611',
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.brandTitle}>Inteliforce Asistencia</Text>
            <Text style={styles.brandSubtitle}>Control de Jornada • Casa Gonzalito S.R.L.</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: estadoBadge.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: estadoBadge.color }]} />
            <Text style={[styles.statusText, { color: estadoBadge.color }]}>{estadoBadge.label}</Text>
          </View>
        </View>

        {/* Tab Switcher - Exclusivo para Supervisores y Gerentes */}
        {isSupervisor ? (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'mi_jornada' && {
                  backgroundColor: theme.primary,
                },
              ]}
              onPress={() => setActiveTab('mi_jornada')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="time"
                size={16}
                color={activeTab === 'mi_jornada' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'mi_jornada' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8' },
                ]}
              >
                Mi Jornada
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'equipo' && {
                  backgroundColor: theme.primary,
                },
              ]}
              onPress={() => setActiveTab('equipo')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people"
                size={16}
                color={activeTab === 'equipo' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'equipo' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8' },
                ]}
              >
                Supervisión Equipo ({teamData?.colaboradores?.length || 33})
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchAttendance();
              if (activeTab === 'equipo') refetchTeam();
            }}
            tintColor={theme.primary}
          />
        }
      >
        {activeTab === 'mi_jornada' ? (
          <>
            {/* Reloj y Tarjeta de Marcación Principal */}
            <Card style={[styles.clockCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {dateFormatted.toUpperCase()}
              </Text>
              <Text style={[styles.clockTime, { color: theme.text }]}>{timeFormatted}</Text>

              {/* Horas de Entrada / Salida */}
              <View style={styles.metricsRow}>
                <View
                  style={[
                    styles.metricBox,
                    { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: theme.border },
                  ]}
                >
                  <View style={styles.metricHeader}>
                    <Ionicons name="log-in-outline" size={16} color="#10B981" />
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>ENTRADA</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {attendance?.hora_entrada ? `${attendance.hora_entrada} hs` : '—'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.metricBox,
                    { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: theme.border },
                  ]}
                >
                  <View style={styles.metricHeader}>
                    <Ionicons name="hourglass-outline" size={16} color="#38BDF8" />
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>TIEMPO ACTIVO</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {estado === 'en_jornada' || estado === 'jornada_cerrada' ? horasTrabajadas : '—'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.metricBox,
                    { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: theme.border },
                  ]}
                >
                  <View style={styles.metricHeader}>
                    <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>SALIDA</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {attendance?.hora_salida ? `${attendance.hora_salida} hs` : '—'}
                  </Text>
                </View>
              </View>

              {/* GPS status */}
              <View style={[styles.gpsBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <Ionicons
                  name={accuracy <= 50 ? 'checkmark-circle' : 'location'}
                  size={16}
                  color={accuracy <= 50 ? '#10B981' : '#F59E0B'}
                />
                <Text style={[styles.gpsText, { color: theme.textSecondary }]}>
                  {isLocating
                    ? 'Adquiriendo precisión GPS...'
                    : location
                    ? `GPS Verificado (±${Math.round(accuracy)}m) • Casa Gonzalito`
                    : 'GPS listo para marcación'}
                </Text>
              </View>

              {/* BOTONES DE ACCIÓN DE JORNADA */}
              <View style={styles.actionsContainer}>
                {estado === 'sin_marcar' && (
                  <Button
                    title="MARCAR ENTRADA"
                    size="lg"
                    variant="primary"
                    loading={punchMutation.isPending}
                    onPress={() => punchMutation.mutate('entrada')}
                    icon={<Ionicons name="finger-print" size={22} color={isDark ? '#002109' : '#FFFFFF'} />}
                    style={styles.mainPunchBtn}
                  />
                )}

                {estado === 'en_jornada' && (
                  <View style={styles.dualButtons}>
                    <TouchableOpacity
                      style={[styles.pauseBtn, { backgroundColor: isDark ? '#78350F' : '#FEF3C7' }]}
                      onPress={() => punchMutation.mutate('almuerzo_inicio')}
                      disabled={punchMutation.isPending}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cafe-outline" size={18} color="#D97706" />
                      <Text style={[styles.pauseBtnText, { color: '#D97706' }]}>Pausa Almuerzo</Text>
                    </TouchableOpacity>

                    <Button
                      title="MARCAR SALIDA"
                      size="lg"
                      variant="danger"
                      loading={punchMutation.isPending}
                      onPress={() =>
                        Alert.alert(
                          'Finalizar Jornada',
                          '¿Estás seguro de registrar tu salida del día?',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Sí, Salir', onPress: () => punchMutation.mutate('salida') },
                          ]
                        )
                      }
                      icon={<Ionicons name="log-out" size={20} color="#FFFFFF" />}
                      style={{ flex: 1.3 }}
                    />
                  </View>
                )}

                {estado === 'en_pausa' && (
                  <Button
                    title="REANUDAR JORNADA"
                    size="lg"
                    variant="primary"
                    loading={punchMutation.isPending}
                    onPress={() => punchMutation.mutate('almuerzo_fin')}
                    icon={<Ionicons name="play" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
                    style={styles.mainPunchBtn}
                  />
                )}

                {estado === 'jornada_cerrada' && (
                  <View style={[styles.closedAlert, { backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE' }]}>
                    <Ionicons name="shield-checkmark" size={22} color="#0284C7" />
                    <Text style={[styles.closedText, { color: '#0284C7' }]}>
                      Jornada de hoy completada y sincronizada con SueldOK RRHH.
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            {/* Ficha de Colaborador (SueldOK RRHH) */}
            <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
                    GESTIÓN DEL PERSONAL
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                    Ficha de Colaborador • SueldOK
                  </Text>
                </View>
                <View style={styles.sueldokBadge}>
                  <Ionicons name="cloud-done" size={14} color="#10B981" />
                  <Text style={styles.sueldokBadgeText}>SueldOK Sync</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>NOMBRE</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>
                    {attendance?.colaborador?.nombre || 'Colaborador Casa Gonzalito'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>CÉDULA DE IDENTIDAD</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>
                    {attendance?.colaborador?.cedula || '—'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>CARGO OFICIAL</Text>
                  <Text style={[styles.infoVal, { color: theme.primary }]}>
                    {attendance?.colaborador?.cargo || 'VENTAS COCA Y MIX'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>DEPARTAMENTO</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>
                    {attendance?.colaborador?.departamento || 'AMAMBAY'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>EMPRESA VINCULADA</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>
                    {attendance?.colaborador?.empresa || 'Casa Gonzalito S.R.L.'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>HORARIO ESTABLECIDO</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>
                    {attendance?.colaborador?.horario || '08:00 - 17:00 hs'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Historial de Marcaciones de Hoy */}
            <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
                REGISTROS DE HOY ({attendance?.marcaciones?.length || 0})
              </Text>

              {attendance?.marcaciones && attendance.marcaciones.length > 0 ? (
                attendance.marcaciones.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.punchRow,
                      { borderBottomColor: isDark ? '#334155' : '#E2E8F0' },
                    ]}
                  >
                    <View style={styles.punchLeft}>
                      <Ionicons
                        name={
                          m.tipo === 'entrada'
                            ? 'log-in'
                            : m.tipo === 'salida'
                            ? 'log-out'
                            : 'cafe'
                        }
                        size={18}
                        color={
                          m.tipo === 'entrada'
                            ? '#10B981'
                            : m.tipo === 'salida'
                            ? '#EF4444'
                            : '#F59E0B'
                        }
                      />
                      <View>
                        <Text style={[styles.punchTipo, { color: theme.text }]}>
                          {m.tipo === 'entrada'
                            ? 'Entrada de Turno'
                            : m.tipo === 'salida'
                            ? 'Salida de Turno'
                            : m.tipo === 'almuerzo_inicio'
                            ? 'Inicio Pausa Almuerzo'
                            : 'Fin Pausa Almuerzo'}
                        </Text>
                        <Text style={[styles.punchCoords, { color: theme.textMuted }]}>
                          {m.coords ? `GPS: ${m.coords.lat.toFixed(4)}, ${m.coords.lng.toFixed(4)}` : 'Sincronizado vía SueldOK'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.punchHora, { color: theme.text }]}>{m.hora} hs</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-outline" size={24} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No hay marcaciones locales registradas para hoy aún.
                  </Text>
                </View>
              )}
            </Card>
          </>
        ) : (
          /* TAB DE EQUIPO SUELDOK */
          <>
            {/* Tarjeta Resumen Equipo */}
            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiNum, { color: theme.text }]}>
                  {teamData?.metricas?.totalEmployees || 33}
                </Text>
                <Text style={[styles.kpiTitle, { color: theme.textMuted }]}>Total Personal</Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiNum, { color: '#10B981' }]}>
                  {teamData?.metricas?.presentToday || 0}
                </Text>
                <Text style={[styles.kpiTitle, { color: theme.textMuted }]}>Presentes Hoy</Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiNum, { color: '#F59E0B' }]}>
                  {teamData?.metricas?.lateToday || 0}
                </Text>
                <Text style={[styles.kpiTitle, { color: theme.textMuted }]}>Tardanzas</Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiNum, { color: '#EF4444' }]}>
                  {teamData?.metricas?.absentToday || 0}
                </Text>
                <Text style={[styles.kpiTitle, { color: theme.textMuted }]}>Ausentes</Text>
              </View>
            </View>

            {/* Buscador de Colaboradores */}
            <View
              style={[
                styles.teamSearchBox,
                { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.border },
              ]}
            >
              <Ionicons name="search" size={18} color={theme.textMuted} />
              <TextInput
                style={[styles.teamSearchInput, { color: theme.text }]}
                placeholder="Buscar por nombre, cargo o cédula..."
                placeholderTextColor={theme.textMuted}
                value={teamSearch}
                onChangeText={setTeamSearch}
              />
              {teamSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTeamSearch('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Lista de Colaboradores */}
            {isLoadingTeam ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 30 }} />
            ) : (
              filteredTeam.map((member) => {
                const isPresent = member.status === 'Present' || member.hoy === 'presente';
                const isLate = member.status === 'Late' || member.status === 'tardanza';
                const statusColor = isPresent ? '#10B981' : isLate ? '#F59E0B' : '#EF4444';
                const statusBg = isPresent
                  ? isDark ? '#064E3B' : '#D1FAE5'
                  : isLate
                  ? isDark ? '#78350F' : '#FEF3C7'
                  : isDark ? '#7F1D1D' : '#FEE2E2';

                return (
                  <Card
                    key={member.id}
                    style={[styles.memberCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                  >
                    <View style={styles.memberLeft}>
                      {member.checkInPhotoUrl ? (
                        <Image source={{ uri: member.checkInPhotoUrl }} style={styles.memberAvatarImg} />
                      ) : (
                        <View style={[styles.memberAvatarInitials, { backgroundColor: theme.primary }]}>
                          <Text style={styles.memberInitialsText}>
                            {member.nombre
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                          {member.nombre}
                        </Text>
                        <Text style={[styles.memberCargo, { color: theme.textSecondary }]}>
                          {member.cargo} • CI: {member.ci}
                        </Text>
                        {member.entrada && member.entrada !== '—' && (
                          <Text style={[styles.memberEntrada, { color: '#10B981' }]}>
                            Marcó entrada: {member.entrada} hs
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={[styles.memberStatusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.memberStatusText, { color: statusColor }]}>
                        {isLate ? 'Tardanza' : isPresent ? 'Presente' : 'Ausente'}
                      </Text>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  clockCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  clockTime: {
    fontSize: 42,
    fontWeight: '900',
    marginVertical: 4,
    letterSpacing: -1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  gpsText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  actionsContainer: {
    marginTop: 16,
    width: '100%',
  },
  mainPunchBtn: {
    width: '100%',
  },
  dualButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  pauseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  pauseBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  closedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  closedText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardSubtitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  sueldokBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  sueldokBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCol: {
    width: '47%',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  punchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  punchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  punchTipo: {
    fontSize: 13,
    fontWeight: '800',
  },
  punchCoords: {
    fontSize: 11,
    marginTop: 1,
  },
  punchHora: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  teamSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  teamSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  memberAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  memberAvatarInitials: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitialsText: {
    color: '#002109',
    fontSize: 14,
    fontWeight: '900',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '800',
  },
  memberCargo: {
    fontSize: 11,
    marginTop: 2,
  },
  memberEntrada: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  memberStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
});

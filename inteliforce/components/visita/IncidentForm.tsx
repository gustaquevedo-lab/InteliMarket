// components/visita/IncidentForm.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';

interface IncidentFormProps {
  visitId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const INCIDENT_TYPES = [
  { id: 'quiebre', label: 'Quiebre de Stock', icon: 'cube-outline' as const },
  { id: 'producto_danado', label: 'Producto Dañado', icon: 'bandage-outline' as const },
  { id: 'falta_espacio', label: 'Falta de Espacio', icon: 'grid-outline' as const },
  { id: 'competencia', label: 'Actividad Competencia', icon: 'trending-up-outline' as const },
  { id: 'otro', label: 'Otro Problema', icon: 'alert-circle-outline' as const },
];

export function IncidentForm({ visitId, onSuccess, onCancel }: IncidentFormProps) {
  const { theme, isDark } = useTheme();

  const URGENCY_LEVELS = [
    { id: 'baja', label: 'Baja', color: theme.info },
    { id: 'normal', label: 'Normal', color: theme.warning },
    { id: 'alta', label: 'Alta', color: theme.danger },
  ];

  const [tipo, setTipo] = useState<string>('quiebre');
  const [urgencia, setUrgencia] = useState<'baja' | 'normal' | 'alta'>('normal');
  const [descripcion, setDescripcion] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { enqueueOrExecute } = useOfflineQueue();

  const handleSubmit = async () => {
    if (descripcion.trim().length < 10) {
      Alert.alert('Descripción requerida', 'Por favor ingresa al menos 10 caracteres detallando la incidencia.');
      return;
    }

    setSubmitting(true);
    const payload = {
      visit_id: visitId,
      tipo,
      urgencia,
      descripcion: descripcion.trim(),
    };

    try {
      await enqueueOrExecute('create_incident', payload, async () => {
        return await api.post(`/visits/${visitId}/incidents`, {
          tipo: payload.tipo,
          urgencia: payload.urgencia,
          descripcion: payload.descripcion,
        });
      });

      Alert.alert('Incidencia registrada', 'El supervisor fue notificado.');
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo enviar la incidencia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Tipo de Incidencia</Text>
      <View style={styles.typesGrid}>
        {INCIDENT_TYPES.map((t) => {
          const selected = tipo === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.typeCard,
                {
                  backgroundColor: isDark ? theme.cardLow : '#FFFFFF',
                  borderColor: selected ? theme.primary : theme.border,
                },
                selected && {
                  backgroundColor: isDark ? '#004B1E' : '#E8F5E9',
                },
              ]}
              onPress={() => setTipo(t.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={t.icon}
                size={22}
                color={selected ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.typeLabel,
                  { color: selected ? theme.primary : theme.textSecondary },
                  selected && { fontWeight: '700' },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Nivel de Urgencia</Text>
      <View style={styles.urgencyRow}>
        {URGENCY_LEVELS.map((u) => {
          const selected = urgencia === u.id;
          return (
            <TouchableOpacity
              key={u.id}
              style={[
                styles.urgencyBtn,
                {
                  backgroundColor: isDark ? theme.cardLow : '#FFFFFF',
                  borderColor: theme.border,
                },
                selected && { backgroundColor: u.color, borderColor: u.color },
              ]}
              onPress={() => setUrgencia(u.id as any)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.urgencyText,
                  { color: selected ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                {u.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="Descripción del hallazgo"
        placeholder="Explica detalladamente la situación observada..."
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        numberOfLines={4}
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />

      <View style={styles.actions}>
        <Button
          title="Guardar Incidencia"
          onPress={handleSubmit}
          loading={submitting}
          variant="primary"
          size="lg"
          style={{ marginBottom: 10 }}
        />
        <Button title="Cancelar" onPress={onCancel} variant="ghost" size="md" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 6,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeCard: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  urgencyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    marginTop: 16,
    marginBottom: 32,
  },
});

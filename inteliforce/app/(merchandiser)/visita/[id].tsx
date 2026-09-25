// app/(merchandiser)/visita/[id].tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { CheckinButton } from '@/components/gps/CheckinButton';
import { MediaUploader } from '@/components/visita/MediaUploader';
import { LoteRow, LotItem } from '@/components/merchandiser/LoteRow';
import { IncidentForm } from '@/components/visita/IncidentForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useVisit } from '@/hooks/useVisit';
import { useLocation } from '@/hooks/useLocation';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';

export default function MerchandiserVisitaScreen() {
  const { id: customerId, razon_social } = useLocalSearchParams<{
    id: string;
    razon_social?: string;
  }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const {
    visitId,
    customerId: activeCustomerId,
    customerName,
    startVisit,
    endVisit,
  } = useVisit();

  const { location, requestFix } = useLocation();
  const { enqueueOrExecute } = useOfflineQueue();

  const isVisitOpen = Boolean(visitId && activeCustomerId === customerId);

  // 4 Tabs: FOTOS | LOTES | INCIDENCIAS | CIERRE
  const [activeTab, setActiveTab] = useState<'fotos' | 'lotes' | 'incidencias' | 'cierre'>('fotos');

  // Lotes query
  const {
    data: lots = [],
    isLoading: loadingLots,
    refetch: refetchLots,
  } = useQuery<LotItem[]>({
    queryKey: ['customer-lots', customerId],
    queryFn: async () => {
      return await api.get<LotItem[]>(`/customers/${customerId}/lot-expiry`);
    },
    enabled: Boolean(customerId && isVisitOpen),
  });

  // Modal para agregar nuevo lote
  const [showAddLotModal, setShowAddLotModal] = useState(false);
  const [newLotProduct, setNewLotProduct] = useState('');
  const [newLotCode, setNewLotCode] = useState('');
  const [newLotExpiry, setNewLotExpiry] = useState(''); // YYYY-MM-DD
  const [newLotUnits, setNewLotUnits] = useState('');
  const [savingLot, setSavingLot] = useState(false);

  // Cierre
  const [cierreNotas, setCierreNotas] = useState('');
  const [closing, setClosing] = useState(false);

  const handleSaveLot = async () => {
    if (!newLotCode.trim() || !newLotExpiry.trim() || !newLotUnits.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa lote, fecha (YYYY-MM-DD) y cantidad.');
      return;
    }

    setSavingLot(true);
    const payload = {
      customer_id: customerId,
      visit_id: visitId,
      items: [
        {
          product_id: newLotProduct.trim() || '00000000-0000-0000-0000-000000000000',
          lote: newLotCode.trim(),
          fecha_vencimiento: newLotExpiry.trim(),
          cantidad_unidades: Number(newLotUnits),
        },
      ],
    };

    try {
      await enqueueOrExecute('upsert_lot_expiry', payload, async () => {
        return await api.put(`/customers/${customerId}/lot-expiry`, payload);
      });

      setShowAddLotModal(false);
      setNewLotCode('');
      setNewLotExpiry('');
      setNewLotUnits('');
      refetchLots();
      Alert.alert('Lote Registrado', 'El lote fue guardado y sincronizado.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar el lote');
    } finally {
      setSavingLot(false);
    }
  };

  const handleCheckout = async () => {
    setClosing(true);
    try {
      const loc = location || (await requestFix());
      const payload = {
        visit_id: visitId,
        lat: loc?.latitude ?? 0,
        lng: loc?.longitude ?? 0,
        notas: cierreNotas.trim() || 'Relevamiento de góndola completado',
        estado: 'cerrada',
      };

      await enqueueOrExecute('checkout', payload, async () => {
        return await api.patch(`/visits/${visitId}/checkout`, payload);
      });

      endVisit();
      Alert.alert('Auditoría Completada', 'La visita ha sido registrada exitosamente.', [
        { text: 'Aceptar', onPress: () => router.replace('/(merchandiser)') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo registrar la salida');
    } finally {
      setClosing(false);
    }
  };

  const clientTitle = razon_social || customerName || 'Punto de Venta';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {clientTitle}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Auditoría de Merchandising</Text>
        </View>
      </View>

      {!isVisitOpen ? (
        /* CHECK-IN REQUERIDO */
        <ScrollView contentContainerStyle={styles.checkinScroll}>
          <Card style={styles.checkinCard}>
            <View style={[styles.avatarBox, { backgroundColor: isDark ? '#151C25' : '#EFF6FF' }]}>
              <Ionicons name="camera-reverse" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.storeName, { color: theme.text }]}>{clientTitle}</Text>
            <Text style={[styles.checkinPrompt, { color: theme.textSecondary }]}>
              Registra tu llegada por GPS al punto de venta para habilitar la subida de evidencias fotográficas,
              control de lotes e incidencias.
            </Text>

            <CheckinButton
              customerId={customerId!}
              customerName={clientTitle}
              onCheckinSuccess={(vId) => {
                startVisit(vId, customerId!, clientTitle);
              }}
            />
          </Card>
        </ScrollView>
      ) : (
        /* VISITA ACTIVA: 4 TABS */
        <View style={styles.visitWrapper}>
          <View style={[styles.tabsRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'fotos' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('fotos')}
            >
              <Ionicons
                name="camera-outline"
                size={16}
                color={activeTab === 'fotos' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'fotos' ? theme.primary : theme.textSecondary },
                  activeTab === 'fotos' && { fontWeight: '800' },
                ]}
              >
                FOTOS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'lotes' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('lotes')}
            >
              <Ionicons
                name="barcode-outline"
                size={16}
                color={activeTab === 'lotes' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'lotes' ? theme.primary : theme.textSecondary },
                  activeTab === 'lotes' && { fontWeight: '800' },
                ]}
              >
                LOTES
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'incidencias' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('incidencias')}
            >
              <Ionicons
                name="warning-outline"
                size={16}
                color={activeTab === 'incidencias' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'incidencias' ? theme.primary : theme.textSecondary },
                  activeTab === 'incidencias' && { fontWeight: '800' },
                ]}
              >
                INCIDENCIAS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'cierre' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('cierre')}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={activeTab === 'cierre' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'cierre' ? theme.primary : theme.textSecondary },
                  activeTab === 'cierre' && { fontWeight: '800' },
                ]}
              >
                CIERRE
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: FOTOS */}
          {activeTab === 'fotos' && (
            <ScrollView contentContainerStyle={styles.tabScroll}>
              <Text style={[styles.tabSectionTitle, { color: theme.text }]}>Evidencias de Góndola y Exhibición</Text>
              <MediaUploader visitId={visitId!} />
            </ScrollView>
          )}

          {/* TAB 2: LOTES */}
          {activeTab === 'lotes' && (
            <ScrollView contentContainerStyle={styles.tabScroll}>
              <View style={styles.lotHeaderRow}>
                <Text style={[styles.tabSectionTitle, { color: theme.text }]}>Control de Vencimientos</Text>
                <Button
                  title="+ Agregar Lote"
                  size="sm"
                  variant="primary"
                  onPress={() => setShowAddLotModal(true)}
                />
              </View>

              {lots.length > 0 ? (
                lots.map((lot) => <LoteRow key={lot.id} lot={lot} />)
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="barcode-outline" size={40} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay lotes registrados para este local</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* TAB 3: INCIDENCIAS */}
          {activeTab === 'incidencias' && (
            <ScrollView contentContainerStyle={styles.tabScroll}>
              <Text style={[styles.tabSectionTitle, { color: theme.text }]}>Reportar Incidencia o Quiebre</Text>
              <IncidentForm
                visitId={visitId!}
                onSuccess={() => setActiveTab('cierre')}
                onCancel={() => {}}
              />
            </ScrollView>
          )}

          {/* TAB 4: CIERRE */}
          {activeTab === 'cierre' && (
            <ScrollView contentContainerStyle={styles.tabScroll}>
              <Card style={styles.cierreCard}>
                <Text style={[styles.cierreTitle, { color: theme.text }]}>Finalizar Auditoría de Merchandising</Text>
                <Input
                  label="Notas u observaciones del relevamiento"
                  placeholder="Detalles sobre competencia, estado de góndola, pop..."
                  value={cierreNotas}
                  onChangeText={setCierreNotas}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 90, textAlignVertical: 'top' }}
                />

                <Button
                  title="Completar y Salir"
                  variant="primary"
                  size="lg"
                  loading={closing}
                  onPress={handleCheckout}
                  icon={<Ionicons name="checkmark-done" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
                  style={{ marginTop: 12 }}
                />
              </Card>
            </ScrollView>
          )}
        </View>
      )}

      {/* Modal Agregar Lote */}
      <Modal visible={showAddLotModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderTopWidth: 1,
              },
            ]}
          >
            <Text style={[styles.modalSheetTitle, { color: theme.text }]}>Registrar Lote de Producto</Text>

            <Input
              label="Código de Lote"
              placeholder="Ej: L2026-09"
              value={newLotCode}
              onChangeText={setNewLotCode}
            />

            <Input
              label="Fecha de Vencimiento (AAAA-MM-DD)"
              placeholder="Ej: 2026-12-31"
              value={newLotExpiry}
              onChangeText={setNewLotExpiry}
            />

            <Input
              label="Cantidad de Unidades"
              placeholder="Ej: 48"
              value={newLotUnits}
              onChangeText={setNewLotUnits}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <Button
                title="Guardar Lote"
                variant="primary"
                size="md"
                loading={savingLot}
                onPress={handleSaveLot}
                style={{ marginBottom: 8 }}
              />
              <Button
                title="Cancelar"
                variant="outline"
                size="md"
                onPress={() => setShowAddLotModal(false)}
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
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  checkinScroll: {
    padding: 20,
    alignItems: 'center',
  },
  checkinCard: {
    width: '100%',
    padding: 20,
    alignItems: 'center',
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  checkinPrompt: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  visitWrapper: {
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  tabSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  lotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
  cierreCard: {
    padding: 18,
  },
  cierreTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalActions: {
    marginTop: 12,
  },
});

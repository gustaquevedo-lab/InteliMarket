// components/visita/RouteMapView.tsx
import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Region, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { RouteStop } from './VisitCard';
import { formatGS } from '@/lib/format';
import { calculateDistanceMeters, formatDistance } from '@/lib/location';
import { haptic } from '@/lib/haptics';

interface EnrichedStop extends RouteStop {
  hasRealGps: boolean;
  displayLat: number;
  displayLng: number;
}

interface RouteMapViewProps {
  stops: RouteStop[];
  userLocation?: { latitude: number; longitude: number } | null;
  onSelectStop: (stop: RouteStop) => void;
  onStartVisit: (stop: RouteStop) => void;
  onOpenLocationModal?: (stop: RouteStop) => void;
}

const { width } = Dimensions.get('window');

export function RouteMapView({
  stops,
  userLocation,
  onSelectStop,
  onStartVisit,
  onOpenLocationModal,
}: RouteMapViewProps) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Mapear clientes asegurando coordenadas para visualización
  const stopsWithCoords: EnrichedStop[] = useMemo(() => {
    return stops.map((s, index) => {
      const hasRealLat =
        s.latitud !== null &&
        s.latitud !== undefined &&
        !isNaN(Number(s.latitud)) &&
        Number(s.latitud) !== 0;
      const hasRealLng =
        s.longitud !== null &&
        s.longitud !== undefined &&
        !isNaN(Number(s.longitud)) &&
        Number(s.longitud) !== 0;

      if (hasRealLat && hasRealLng) {
        return {
          ...s,
          hasRealGps: true,
          displayLat: Number(s.latitud),
          displayLng: Number(s.longitud),
        };
      }

      // Fallback: Si el cliente aún no tiene GPS registrado, proyectamos una posición
      // estimada en el área comercial de Pedro Juan Caballero para que la ruta se pueda visualizar
      const baseLat = userLocation?.latitude ?? -22.548;
      const baseLng = userLocation?.longitude ?? -55.728;
      const offsetLat = ((index % 5) - 2) * 0.0035;
      const offsetLng = (Math.floor(index / 5) - 1) * 0.004;

      return {
        ...s,
        hasRealGps: false,
        displayLat: baseLat + offsetLat,
        displayLng: baseLng + offsetLng,
      };
    });
  }, [stops, userLocation]);

  const [activeStop, setActiveStop] = useState<EnrichedStop | null>(
    stopsWithCoords.length > 0 ? stopsWithCoords[0] : null
  );

  // Sincronizar parada activa si cambian las paradas
  useEffect(() => {
    if (stopsWithCoords.length > 0 && !activeStop) {
      setActiveStop(stopsWithCoords[0]);
    }
  }, [stopsWithCoords, activeStop]);

  // Región inicial: ubicación del usuario, o primer cliente, o fallback Pedro Juan Caballero
  const initialRegion: Region = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      };
    }
    if (stopsWithCoords.length > 0) {
      return {
        latitude: stopsWithCoords[0].displayLat,
        longitude: stopsWithCoords[0].displayLng,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      };
    }
    // Fallback: Centro comercial de Pedro Juan Caballero / Amambay
    return {
      latitude: -22.548,
      longitude: -55.728,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [userLocation, stopsWithCoords]);

  // Animar hacia la región cuando el mapa esté listo
  useEffect(() => {
    if (mapReady && mapRef.current) {
      if (userLocation) {
        mapRef.current.animateToRegion(
          {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          600
        );
      } else if (stopsWithCoords.length > 0) {
        mapRef.current.animateToRegion(
          {
            latitude: stopsWithCoords[0].displayLat,
            longitude: stopsWithCoords[0].displayLng,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          600
        );
      }
    }
  }, [mapReady]);

  const handleMarkerPress = (stop: EnrichedStop) => {
    haptic.light();
    setActiveStop(stop);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: stop.displayLat,
          longitude: stop.displayLng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        400
      );
    }
  };

  const centerOnUser = () => {
    haptic.medium();
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
  };

  const activeDistance = useMemo(() => {
    if (userLocation && activeStop) {
      const dist = calculateDistanceMeters(
        userLocation.latitude,
        userLocation.longitude,
        activeStop.displayLat,
        activeStop.displayLng
      );
      return formatDistance(dist);
    }
    return null;
  }, [userLocation, activeStop]);

  const unmappedCount = useMemo(
    () => stopsWithCoords.filter((s) => !s.hasRealGps).length,
    [stopsWithCoords]
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        toolbarEnabled={false}
        scrollEnabled={true}
        mapType="standard"
        onMapReady={() => setMapReady(true)}
      >
        {/* Trazado de ruta conectando las paradas en orden de visita */}
        {stopsWithCoords.length > 1 && (
          <Polyline
            coordinates={stopsWithCoords.map((s) => ({
              latitude: s.displayLat,
              longitude: s.displayLng,
            }))}
            strokeColor={theme.primary}
            strokeWidth={3}
          />
        )}

        {stopsWithCoords.map((stop, index) => {
          const isSelected = activeStop?.customer_id === stop.customer_id;
          const isCompleted = stop.estado === 'cerrada';
          const isInProgress = stop.estado === 'abierta';
          const isMoroso = (stop.documentos_vencidos ?? 0) > 0;

          // Color del pin
          let pinBg = '#0284C7'; // Cyan por defecto
          if (isCompleted) pinBg = '#10B981';
          else if (isInProgress) pinBg = '#2563EB';
          else if (isMoroso) pinBg = '#DC2626';

          const orderNum = stop.orden_visita > 0 ? stop.orden_visita : index + 1;

          return (
            <Marker
              key={stop.customer_id}
              coordinate={{ latitude: stop.displayLat, longitude: stop.displayLng }}
              onPress={() => handleMarkerPress(stop)}
              zIndex={isSelected ? 99 : 10}
            >
              <View
                style={[
                  styles.markerCircle,
                  {
                    backgroundColor: pinBg,
                    borderColor: isSelected
                      ? '#FFFFFF'
                      : stop.hasRealGps
                      ? 'rgba(0,0,0,0.2)'
                      : '#F59E0B',
                    borderWidth: stop.hasRealGps ? 2 : 2.5,
                    borderStyle: stop.hasRealGps ? 'solid' : 'dashed',
                    transform: [{ scale: isSelected ? 1.25 : 1.0 }],
                  },
                ]}
              >
                <Text style={styles.markerText}>{orderNum}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Indicador de carga no bloqueante */}
      {!mapReady && (
        <View
          style={[
            styles.loadingBadge,
            { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)' },
          ]}
        >
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingBadgeText, { color: theme.textSecondary }]}>
            Iniciando mapa...
          </Text>
        </View>
      )}

      {/* Aviso informativo si hay clientes sin coordenadas GPS exactas */}
      {unmappedCount > 0 && mapReady && (
        <View style={[styles.unmappedBanner, { backgroundColor: isDark ? '#332400' : '#FEF3C7' }]}>
          <Ionicons name="information-circle" size={16} color="#D97706" />
          <Text style={[styles.unmappedText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
            {unmappedCount === stopsWithCoords.length
              ? 'Mostrando ubicaciones estimadas en Pedro Juan Caballero'
              : `${unmappedCount} clientes con ubicación GPS estimada`}
          </Text>
        </View>
      )}

      {/* Botón flotante para recentrar en mi posición */}
      {userLocation && (
        <TouchableOpacity
          style={[styles.recenterBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
          onPress={centerOnUser}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={theme.primary} />
        </TouchableOpacity>
      )}

      {/* Tarjeta flotante inferior con la parada seleccionada */}
      {activeStop && (
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.previewHeader}>
            <View
              style={[
                styles.orderBadge,
                { backgroundColor: activeStop.hasRealGps ? '#0284C7' : '#D97706' },
              ]}
            >
              <Text style={styles.orderBadgeText}>
                #{activeStop.orden_visita > 0 ? activeStop.orden_visita : 1}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[styles.previewTitle, { color: theme.text }]}
                numberOfLines={1}
              >
                {activeStop.nombre_fantasia || activeStop.razon_social}
              </Text>
              <Text style={[styles.previewSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {activeStop.hasRealGps ? (
                  activeDistance ? `A ${activeDistance}` : activeStop.direccion || 'Ubicación GPS registrada'
                ) : (
                  '⚠️ GPS pendiente • Ubicación estimada'
                )}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => onSelectStop(activeStop)}
              style={styles.moreBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {/* Fila de Acciones rápidas en mapa */}
          <View style={styles.actionsRow}>
            {activeStop.hasRealGps ? (
              <TouchableOpacity
                style={[styles.mapNavBtn, { backgroundColor: '#38BDF8' }]}
                onPress={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${activeStop.displayLat},${activeStop.displayLng}`;
                  Linking.openURL(url);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={15} color="#0F172A" />
                <Text style={styles.mapNavBtnText}>GPS</Text>
              </TouchableOpacity>
            ) : onOpenLocationModal ? (
              <TouchableOpacity
                style={[styles.mapNavBtn, { backgroundColor: '#F59E0B' }]}
                onPress={() => onOpenLocationModal(activeStop)}
                activeOpacity={0.8}
              >
                <Ionicons name="location-outline" size={15} color="#0F172A" />
                <Text style={styles.mapNavBtnText}>Fijar GPS</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.visitActionBtn, { backgroundColor: theme.primary }]}
              onPress={() => onStartVisit(activeStop)}
              activeOpacity={0.85}
            >
              <Ionicons name="location" size={16} color="#FFFFFF" />
              <Text style={styles.visitActionBtnText}>Iniciar Visita</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {stops.length === 0 && (
        <View style={[styles.emptyOverlay, { backgroundColor: theme.card }]}>
          <Ionicons name="map-outline" size={40} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No hay clientes en este filtro para mostrar en el mapa.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  loadingBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 30,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  loadingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unmappedBanner: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
    zIndex: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  unmappedText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  previewCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  orderBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  moreBtn: {
    padding: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mapNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
    gap: 6,
  },
  mapNavBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  visitActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
    gap: 8,
  },
  visitActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyOverlay: {
    position: 'absolute',
    top: '35%',
    left: 24,
    right: 24,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
});

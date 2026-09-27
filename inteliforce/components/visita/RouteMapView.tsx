// components/visita/RouteMapView.tsx
import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { RouteStop } from './VisitCard';
import { formatGS } from '@/lib/format';
import { calculateDistanceMeters, formatDistance } from '@/lib/location';
import { haptic } from '@/lib/haptics';

interface RouteMapViewProps {
  stops: RouteStop[];
  userLocation?: { latitude: number; longitude: number } | null;
  onSelectStop: (stop: RouteStop) => void;
  onStartVisit: (stop: RouteStop) => void;
}

const { width, height } = Dimensions.get('window');

export function RouteMapView({
  stops,
  userLocation,
  onSelectStop,
  onStartVisit,
}: RouteMapViewProps) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<MapView | null>(null);

  // Filtrar solo las paradas con coordenadas válidas
  const geoStops = useMemo(() => {
    return stops.filter(
      (s) =>
        s.latitud !== null &&
        s.latitud !== undefined &&
        s.longitud !== null &&
        s.longitud !== undefined &&
        !isNaN(Number(s.latitud)) &&
        !isNaN(Number(s.longitud)) &&
        Number(s.latitud) !== 0 &&
        Number(s.longitud) !== 0
    );
  }, [stops]);

  const [activeStop, setActiveStop] = useState<RouteStop | null>(
    geoStops.length > 0 ? geoStops[0] : null
  );

  // Región inicial: primer cliente o ubicación del usuario, o fallback Pedro Juan Caballero
  const initialRegion: Region = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    if (geoStops.length > 0 && geoStops[0].latitud && geoStops[0].longitud) {
      return {
        latitude: Number(geoStops[0].latitud),
        longitude: Number(geoStops[0].longitud),
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    // Fallback: Centro de Pedro Juan Caballero / Amambay
    return {
      latitude: -22.562,
      longitude: -55.733,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [geoStops, userLocation]);

  const handleMarkerPress = (stop: RouteStop) => {
    haptic.light();
    setActiveStop(stop);
    if (mapRef.current && stop.latitud && stop.longitud) {
      mapRef.current.animateToRegion(
        {
          latitude: Number(stop.latitud),
          longitude: Number(stop.longitud),
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
    if (
      userLocation &&
      activeStop?.latitud &&
      activeStop?.longitud
    ) {
      const dist = calculateDistanceMeters(
        userLocation.latitude,
        userLocation.longitude,
        Number(activeStop.latitud),
        Number(activeStop.longitud)
      );
      return formatDistance(dist);
    }
    return null;
  }, [userLocation, activeStop]);

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
      >
        {geoStops.map((stop, index) => {
          const lat = Number(stop.latitud);
          const lng = Number(stop.longitud);
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
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handleMarkerPress(stop)}
              zIndex={isSelected ? 99 : 10}
            >
              <View
                style={[
                  styles.markerCircle,
                  {
                    backgroundColor: pinBg,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(0,0,0,0.2)',
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
            <View style={styles.orderBadge}>
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
                {activeStop.ruc ? `RUC: ${activeStop.ruc}` : activeStop.direccion || 'Casa Gonzalito'}
                {activeDistance ? ` • A ${activeDistance}` : ''}
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
            {activeStop.latitud && activeStop.longitud ? (
              <TouchableOpacity
                style={[styles.mapNavBtn, { backgroundColor: '#38BDF8' }]}
                onPress={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${activeStop.latitud},${activeStop.longitud}`;
                  Linking.openURL(url);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={15} color="#0F172A" />
                <Text style={styles.mapNavBtnText}>GPS</Text>
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

      {geoStops.length === 0 && (
        <View style={[styles.emptyOverlay, { backgroundColor: theme.card }]}>
          <Ionicons name="map-outline" size={40} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No hay clientes con coordenadas registradas en esta ruta.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
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

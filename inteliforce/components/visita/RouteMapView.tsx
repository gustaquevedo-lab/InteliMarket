// components/visita/RouteMapView.tsx
import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { RouteStop } from './VisitCard';
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
  const webViewRef = useRef<WebView | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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

  const handleMarkerSelect = (customerId: string) => {
    haptic.light();
    const found = stopsWithCoords.find((s) => s.customer_id === customerId);
    if (found) {
      setActiveStop(found);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `if (window.panToMarker) { window.panToMarker('${customerId}', ${found.displayLat}, ${found.displayLng}); } true;`
        );
      }
    }
  };

  const centerOnUser = () => {
    haptic.medium();
    if (webViewRef.current && userLocation) {
      webViewRef.current.injectJavaScript(
        `if (window.centerOnCoords) { window.centerOnCoords(${userLocation.latitude}, ${userLocation.longitude}); } true;`
      );
    }
  };

  const fitAllStops = () => {
    haptic.light();
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.fitRouteBounds) { window.fitRouteBounds(); } true;`
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

  // Serializar datos para Leaflet
  const serializedStops = useMemo(() => {
    return stopsWithCoords.map((stop, index) => {
      const isCompleted = stop.estado === 'cerrada';
      const isInProgress = stop.estado === 'abierta';
      const isMoroso = (stop.documentos_vencidos ?? 0) > 0;

      let pinBg = '#0284C7'; // Cyan por defecto
      if (isCompleted) pinBg = '#10B981';
      else if (isInProgress) pinBg = '#2563EB';
      else if (isMoroso) pinBg = '#DC2626';

      const orderNum = stop.orden_visita > 0 ? stop.orden_visita : index + 1;

      return {
        customer_id: stop.customer_id,
        nombre: stop.nombre_fantasia || stop.razon_social,
        displayLat: stop.displayLat,
        displayLng: stop.displayLng,
        hasRealGps: stop.hasRealGps,
        pinBg,
        orderNum,
      };
    });
  }, [stopsWithCoords]);

  const initialLat = userLocation?.latitude ?? (stopsWithCoords[0]?.displayLat ?? -22.548);
  const initialLng = userLocation?.longitude ?? (stopsWithCoords[0]?.displayLng ?? -55.728);

  const leafletHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { -webkit-tap-highlight-color: transparent; }
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: ${isDark ? '#0f172a' : '#f8fafc'};
    }
    .custom-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: #ffffff;
      font-weight: 800;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 3px 6px rgba(0,0,0,0.35);
      cursor: pointer;
      user-select: none;
      transition: transform 0.15s ease;
    }
    .custom-marker.active {
      transform: scale(1.3);
      border-color: #ffffff !important;
      box-shadow: 0 5px 14px rgba(0,0,0,0.55);
    }
    .user-marker-pulse {
      width: 18px;
      height: 18px;
      background: #0284C7;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.45);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.6); }
      70% { box-shadow: 0 0 0 10px rgba(2, 132, 199, 0); }
      100% { box-shadow: 0 0 0 2px rgba(2, 132, 199, 0); }
    }
    .leaflet-control-attribution {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${initialLat}, ${initialLng}], 14);

    // Mosaicos CartoDB Voyager de alta calidad
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    var markerElements = {};
    var stops = ${JSON.stringify(serializedStops)};
    var activeId = '${activeStop?.customer_id || ''}';

    // Polyline conectando la ruta en orden
    var latlngs = stops.map(function(s) { return [s.displayLat, s.displayLng]; });
    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: '${theme.primary}',
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Marcador de posición del vendedor
    ${userLocation ? `
      var userIcon = L.divIcon({
        className: 'user-icon-wrap',
        html: '<div class="user-marker-pulse"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
        icon: userIcon,
        zIndexOffset: 1000
      }).addTo(map);
    ` : ''}

    // Marcadores numerados de paradas
    stops.forEach(function(s) {
      var isAct = s.customer_id === activeId;
      var border = s.hasRealGps ? '2px solid rgba(0,0,0,0.2)' : '2.5px dashed #F59E0B';
      if (isAct) border = '3px solid #FFFFFF';

      var el = document.createElement('div');
      el.className = 'custom-marker' + (isAct ? ' active' : '');
      el.style.backgroundColor = s.pinBg;
      el.style.border = border;
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.fontSize = '12px';
      el.textContent = s.orderNum;

      var icon = L.divIcon({
        className: 'leaflet-marker-clean',
        html: el.outerHTML,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      var m = L.marker([s.displayLat, s.displayLng], {
        icon: icon,
        zIndexOffset: isAct ? 500 : 100
      }).addTo(map);

      m.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_STOP', id: s.customer_id }));
        }
      });

      markerElements[s.customer_id] = m;
    });

    // Auto-ajustar vista para abarcar paradas
    window.fitRouteBounds = function() {
      if (latlngs.length > 0) {
        var bounds = L.latLngBounds(latlngs);
        ${userLocation ? `bounds.extend([${userLocation.latitude}, ${userLocation.longitude}]);` : ''}
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    };

    window.panToMarker = function(id, lat, lng) {
      map.setView([lat, lng], 16, { animate: true, duration: 0.5 });
    };

    window.centerOnCoords = function(lat, lng) {
      map.setView([lat, lng], 16, { animate: true, duration: 0.5 });
    };

    // Ajuste inicial de límites
    if (latlngs.length > 1) {
      window.fitRouteBounds();
    }
  </script>
</body>
</html>`;
  }, [isDark, serializedStops, initialLat, initialLng, userLocation, theme.primary]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadEnd={() => setMapLoaded(true)}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'SELECT_STOP' && data.id) {
              handleMarkerSelect(data.id);
            }
          } catch {}
        }}
      />

      {/* Indicador de carga no bloqueante */}
      {!mapLoaded && (
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
      {unmappedCount > 0 && mapLoaded && (
        <View style={[styles.unmappedBanner, { backgroundColor: isDark ? '#332400' : '#FEF3C7' }]}>
          <Ionicons name="information-circle" size={16} color="#D97706" />
          <Text style={[styles.unmappedText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
            {unmappedCount === stopsWithCoords.length
              ? 'Mostrando ubicaciones estimadas en Pedro Juan Caballero'
              : `${unmappedCount} clientes con ubicación GPS estimada`}
          </Text>
        </View>
      )}

      {/* Botones flotantes de mapa: Ajustar Ruta y Mi Posición */}
      <View style={styles.fabControls}>
        <TouchableOpacity
          style={[styles.mapFabBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
          onPress={fitAllStops}
          activeOpacity={0.8}
          accessibilityLabel="Ajustar mapa a la ruta"
        >
          <Ionicons name="scan-outline" size={20} color={theme.text} />
        </TouchableOpacity>

        {userLocation && (
          <TouchableOpacity
            style={[styles.mapFabBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
            onPress={centerOnUser}
            activeOpacity={0.8}
            accessibilityLabel="Centrar en mi ubicación"
          >
            <Ionicons name="locate" size={20} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

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
    backgroundColor: 'transparent',
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
  fabControls: {
    position: 'absolute',
    right: 14,
    top: 14,
    gap: 10,
    zIndex: 20,
  },
  mapFabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  previewCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    zIndex: 25,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewSub: {
    fontSize: 12,
    marginTop: 2,
  },
  moreBtn: {
    padding: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mapNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  visitActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  visitActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    zIndex: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
});

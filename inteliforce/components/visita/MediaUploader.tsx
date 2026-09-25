// components/visita/MediaUploader.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { enqueueOfflineMedia } from '@/lib/offline/queue';
import { api } from '@/lib/api';

export interface MediaItem {
  id: string;
  uri: string;
  tipo: 'foto' | 'video';
  status: 'uploading' | 'done' | 'pending';
}

interface MediaUploaderProps {
  visitId: string;
}

export function MediaUploader({ visitId }: MediaUploaderProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const { isConnected } = useOfflineQueue();
  const { theme, isDark } = useTheme();

  const handleCapturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara para tomar evidencias.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      processSelectedMedia(result.assets[0].uri, 'foto');
    }
  };

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const tipo = asset.type === 'video' ? 'video' : 'foto';
      processSelectedMedia(asset.uri, tipo);
    }
  };

  const processSelectedMedia = async (localUri: string, tipo: 'foto' | 'video') => {
    const tempId = `media_${Date.now()}`;
    const newMedia: MediaItem = {
      id: tempId,
      uri: localUri,
      tipo,
      status: 'uploading',
    };

    setMediaList((prev) => [newMedia, ...prev]);

    if (!isConnected) {
      // Offline: Encolar en pending_media
      await enqueueOfflineMedia(visitId, tipo, localUri);
      setMediaList((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'pending' } : m))
      );
      return;
    }

    // Online: Subir inmediatamente
    try {
      const formData = new FormData();
      const filename = localUri.split('/').pop() || (tipo === 'video' ? 'video.mp4' : 'foto.jpg');
      formData.append('file', {
        uri: localUri,
        name: filename,
        type: tipo === 'video' ? 'video/mp4' : 'image/jpeg',
      } as any);
      formData.append('tipo', tipo);
      formData.append('visit_id', visitId);

      await api.upload(`/visits/${visitId}/media`, formData);

      setMediaList((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'done' } : m))
      );
    } catch {
      // Fallback a cola offline en caso de error
      await enqueueOfflineMedia(visitId, tipo, localUri);
      setMediaList((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'pending' } : m))
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Botones de acción */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          onPress={handleCapturePhoto}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={20} color={isDark ? '#002109' : '#FFFFFF'} />
          <Text style={[styles.actionBtnText, { color: isDark ? '#002109' : '#FFFFFF' }]}>
            Tomar Foto
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.galleryBtn,
            {
              backgroundColor: isDark ? theme.cardLow : '#EFF6FF',
              borderColor: isDark ? theme.border : '#BFDBFE',
            },
          ]}
          onPress={handlePickGallery}
          activeOpacity={0.8}
        >
          <Ionicons name="images-outline" size={20} color={theme.primary} />
          <Text style={[styles.actionBtnText, { color: theme.primary }]}>Galería</Text>
        </TouchableOpacity>
      </View>

      {/* Grid horizontal de evidencias */}
      {mediaList.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryScroll}
        >
          {mediaList.map((item) => (
            <View key={item.id} style={styles.mediaCard}>
              <Image source={{ uri: item.uri }} style={styles.thumbnail} />

              {item.tipo === 'video' && (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={14} color="#FFFFFF" />
                </View>
              )}

              <View style={[styles.statusBadge, styles[`status_${item.status}`]]}>
                <Ionicons
                  name={
                    item.status === 'done'
                      ? 'checkmark-circle'
                      : item.status === 'uploading'
                      ? 'sync'
                      : 'cloud-offline'
                  }
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.statusText}>
                  {item.status === 'done'
                    ? 'Listo'
                    : item.status === 'uploading'
                    ? 'Subiendo'
                    : 'En cola'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: isDark ? theme.cardLow : '#F8FAFC',
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="camera-outline" size={32} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No hay fotos capturadas en esta visita todavía.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  galleryBtn: {
    borderWidth: 1.5,
  },
  actionBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  galleryScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  mediaCard: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  status_done: {
    backgroundColor: 'rgba(22, 163, 74, 0.85)',
  },
  status_uploading: {
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
  },
  status_pending: {
    backgroundColor: 'rgba(217, 119, 6, 0.85)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
  },
});

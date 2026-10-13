// hooks/useOfflineQueue.ts
import { useState, useEffect, useCallback } from 'react';
import * as Network from 'expo-network';
import { offlineDb } from '@/lib/offline/db';
import { enqueueOfflineOperation, syncOfflineQueue } from '@/lib/offline/queue';
import { isNetworkError } from '@/lib/api';

export function useOfflineQueue() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshState = useCallback(async () => {
    try {
      const net = await Network.getNetworkStateAsync();
      const connected = Boolean(net.isConnected && (net.isInternetReachable ?? true));
      setIsConnected(connected);

      const count = await offlineDb.getPendingCount();
      setPendingCount(count);

      // Si volvió la conexión y hay pendientes, disparar sincronización
      if (connected && count > 0) {
        setIsSyncing(true);
        await syncOfflineQueue();
        const updatedCount = await offlineDb.getPendingCount();
        setPendingCount(updatedCount);
        setIsSyncing(false);
      }
    } catch {
      // Ignorar errores transitorios de lectura de red
    }
  }, []);

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 10000); // Chequeo periódico cada 10s
    return () => clearInterval(interval);
  }, [refreshState]);

  const triggerSync = async () => {
    if (!isConnected) return;
    setIsSyncing(true);
    await syncOfflineQueue();
    const count = await offlineDb.getPendingCount();
    setPendingCount(count);
    setIsSyncing(false);
  };

  /**
   * Ejecuta la operación inmediatamente si hay red, o la envía a la cola offline
   * si está desconectado o si la llamada falla por error de red.
   */
  const enqueueOrExecute = async <T>(
    opType: Parameters<typeof enqueueOfflineOperation>[0],
    payload: any,
    executeFn: () => Promise<T>
  ): Promise<{ data?: T; queued: boolean; queueId?: string }> => {
    if (!isConnected) {
      const queueId = await enqueueOfflineOperation(opType, payload);
      setPendingCount((prev) => prev + 1);
      return { queued: true, queueId };
    }

    try {
      const result = await executeFn();
      return { data: result, queued: false };
    } catch (err: any) {
      if (isNetworkError(err)) {
        const queueId = await enqueueOfflineOperation(opType, payload);
        setPendingCount((prev) => prev + 1);
        return { queued: true, queueId };
      }
      throw err;
    }
  };

  return {
    isConnected,
    pendingCount,
    isSyncing,
    triggerSync,
    enqueueOrExecute,
  };
}

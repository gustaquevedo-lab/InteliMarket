/**
 * Offline Sync Engine
 * CRDT-inspired conflict resolution: last-write-wins with server authority
 * Queues all mutations when offline, replays in order when online
 */

import * as SecureStore from "expo-secure-store"
import NetInfo from "@react-native-community/netinfo"
import { api, replayQueue } from "./api"
import { useAppStore } from "../stores/appStore"

const SYNC_KEY = "sync_queue"
const MAX_RETRIES = 5
const BATCH_SIZE = 10

interface SyncOperation {
  id: string
  type: "gps_ping" | "visit_complete" | "order_create" | "route_start" | "route_end" | "profile_update"
  payload: any
  status: "pending" | "syncing" | "done" | "error"
  created_at: string
  retry_count: number
  last_error?: string
}

let syncInProgress = false
let unsubscribeNetInfo: (() => void) | null = null

export function startSyncEngine() {
  // Listen to network changes
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false
    useAppStore.getState().setIsOnline(isOnline)
    if (isOnline) {
      processSyncQueue()
    }
  })
  // Also set initial state
  NetInfo.fetch().then((state) => {
    const isOnline = state.isConnected === true
    useAppStore.getState().setIsOnline(isOnline)
    if (isOnline) processSyncQueue()
  })
}

export function stopSyncEngine() {
  if (unsubscribeNetInfo) unsubscribeNetInfo()
}

export async function enqueueOperation(op: Omit<SyncOperation, "id" | "status" | "created_at" | "retry_count">) {
  const operation: SyncOperation = {
    ...op,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    status: "pending",
    created_at: new Date().toISOString(),
    retry_count: 0,
  }

  try {
    const existing = await SecureStore.getItemAsync(SYNC_KEY)
    const queue: SyncOperation[] = existing ? JSON.parse(existing) : []
    queue.push(operation)
    await SecureStore.setItemAsync(SYNC_KEY, JSON.stringify(queue))
    useAppStore.getState().setSyncQueueCount(queue.length)

    // Try to process immediately if online
    if (useAppStore.getState().isOnline) {
      processSyncQueue()
    }
  } catch {}
}

export async function processSyncQueue(): Promise<number> {
  if (syncInProgress) return 0
  syncInProgress = true

  try {
    const raw = await SecureStore.getItemAsync(SYNC_KEY)
    if (!raw) return 0

    const queue: SyncOperation[] = JSON.parse(raw)
    if (queue.length === 0) return 0

    let processed = 0
    const remaining: SyncOperation[] = []

    for (const op of queue) {
      if (processed >= BATCH_SIZE) {
        remaining.push(op)
        continue
      }

      if (op.retry_count >= MAX_RETRIES) {
        remaining.push(op)
        continue
      }

      try {
        op.status = "syncing"
        await executeOperation(op)
        op.status = "done"
        processed++
      } catch (error: any) {
        op.retry_count++
        op.last_error = error.message
        op.status = "error"
        remaining.push(op)
      }
    }

    // Save remaining (failed + unprocessed)
    await SecureStore.setItemAsync(SYNC_KEY, JSON.stringify(remaining))
    useAppStore.getState().setSyncQueueCount(remaining.length)

    // Also try server-side replay
    const replayed = await replayQueue()
    processed += replayed

    return processed
  } catch {
    return 0
  } finally {
    syncInProgress = false
  }
}

async function executeOperation(op: SyncOperation) {
  const store = useAppStore.getState()
  const companyId = store.user?.company_id
  const profile = store.profile

  switch (op.type) {
    case "gps_ping":
      if (profile) {
        await api.tracking.ping(profile.id, op.payload)
      }
      break

    case "visit_complete":
      await api.routes.stops.complete(op.payload.stop_id, op.payload.data)
      break

    case "order_create":
      if (companyId) {
        await api.orders.create(companyId, op.payload)
      }
      break

    case "route_start":
      await api.routes.start(op.payload.instance_id)
      break

    case "route_end":
      await api.routes.end(op.payload.instance_id)
      break
  }
}

export async function getQueueStats(): Promise<{ total: number; pending: number; errors: number }> {
  try {
    const raw = await SecureStore.getItemAsync(SYNC_KEY)
    if (!raw) return { total: 0, pending: 0, errors: 0 }
    const queue: SyncOperation[] = JSON.parse(raw)
    return {
      total: queue.length,
      pending: queue.filter((o) => o.status === "pending").length,
      errors: queue.filter((o) => o.status === "error").length,
    }
  } catch {
    return { total: 0, pending: 0, errors: 0 }
  }
}

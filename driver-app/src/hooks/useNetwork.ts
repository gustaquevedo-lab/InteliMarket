import { useEffect, useCallback } from "react"
import NetInfo from "@react-native-community/netinfo"
import { useDriverStore } from "../stores/driverStore"
import { replayQueue } from "../services/api"

export function useNetwork() {
  const setIsOnline = useDriverStore((s) => s.setIsOnline)
  const isOnline = useDriverStore((s) => s.isOnline)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false
      setIsOnline(online)
      if (online) {
        replayQueue()
      }
    })
    return () => unsubscribe()
  }, [setIsOnline])

  const checkNow = useCallback(async () => {
    const state = await NetInfo.fetch()
    const online = state.isConnected ?? false
    setIsOnline(online)
    if (online) await replayQueue()
    return online
  }, [setIsOnline])

  return { isOnline, checkNow }
}

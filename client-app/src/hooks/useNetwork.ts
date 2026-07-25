import { useState, useEffect } from "react"
import NetInfo from "@react-native-community/netinfo"

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true))
    return () => unsub()
  }, [])
  return isOnline
}

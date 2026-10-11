import { useSyncExternalStore } from "react"
import { terminalLock } from "./terminalLock"

export function useTerminalBusy(ip: string | undefined): boolean {
  return useSyncExternalStore(
    terminalLock.subscribe,
    () => (ip === undefined ? false : terminalLock.isBusy(ip)),
    () => false,
  )
}

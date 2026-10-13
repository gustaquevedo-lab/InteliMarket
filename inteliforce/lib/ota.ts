// lib/ota.ts
import * as Updates from 'expo-updates';

export async function checkForUpdate() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      return true;
    }
  } catch {
    // Silently ignore OTA errors when server is not configured yet
  }
  return false;
}

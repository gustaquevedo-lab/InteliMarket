import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.intelimarket.extrasalon',
  appName: 'Extra Salón',
  webDir: '../ui-web-dist',
  server: {
    url: 'http://192.168.0.10:5173/operaciones-salon',
    cleartext: true,
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;

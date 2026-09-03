import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.intelimarket.supervisor',
  appName: 'Extra Supervisor',
  webDir: '../ui-web-dist',
  server: {
    url: 'http://192.168.0.10:5173/pos/supervisor',
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

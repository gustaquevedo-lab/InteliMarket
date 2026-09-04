import type { CapacitorConfig } from '@capacitor/cli';

const target = process.env.CAPACITOR_TARGET || 'deposito';
const isDeposito = target === 'deposito';

const config: CapacitorConfig = {
  appId: isDeposito ? 'com.intelimarket.deposito' : 'com.intelimarket.supervisor',
  appName: isDeposito ? 'Extra Depósito' : 'Extra Supervisor',
  webDir: '../ui-web-dist',
  server: {
    url: isDeposito ? 'http://192.168.0.10:5173/deposito' : 'http://192.168.0.10:5173/supervisor',
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


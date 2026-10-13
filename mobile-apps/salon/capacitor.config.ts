import type { CapacitorConfig } from '@capacitor/cli';

// App nativa independiente (proyecto Android propio en ./android, sin
// compartir identidad con ninguna otra app de mobile-apps/). Carga el
// contenido en vivo desde el dominio publico con HTTPS real -- necesario
// para que la camara (getUserMedia / escaneo de codigo de barra) funcione:
// un WebView apuntando a HTTP plano en la LAN no es "contexto seguro" y
// el navegador bloquea la camara.
const config: CapacitorConfig = {
  appId: 'com.intelimarket.salon',
  appName: 'Extra Salón',
  webDir: 'www',
  server: {
    url: 'https://intelimarket.superextra.com.py/operaciones-salon',
    androidScheme: 'https',
  },
};

export default config;

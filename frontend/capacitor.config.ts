import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finanzas.app',
  appName: 'Finanzas',
  // Carpeta que genera "ng build"
  webDir: 'dist/frontend/browser',
  server: {
    // La app se sirve desde https://localhost dentro de la app.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

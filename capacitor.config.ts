import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trustmomos.pos',
  appName: 'TRUST MOMOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

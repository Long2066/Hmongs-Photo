import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.toolphoto.app',
  appName: 'ImageTool',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#f4f3fb'
  },
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aziz.revenue',
  appName: 'fluffy-turtle-trot',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true
  }
};

// Custom URL scheme for Google OAuth redirect
// Must match REDIRECT_URI in src/utils/googleDrive.ts
// Register this scheme in Google Cloud Console as an authorized redirect URI

export default config;

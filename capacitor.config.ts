import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aziz.revenue',
  appName: 'Aziz Revenue',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#0F9D8A",
    },
    GoogleAuth: {
      androidClientId: "777494765857-ebqhqcdvmvnevheq0qep52thgrgnq5qa.apps.googleusercontent.com",
      serverClientId: "777494765857-lhndrn52q4ptemrekskbf0kgepei21mi.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
      scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"],
    },
  },
};

export default config;

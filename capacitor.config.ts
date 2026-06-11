import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.matzil.sar',
  appName: 'Matzil SAR',
  webDir: 'out',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'xyz.degenfeed.app',
  appName: 'DegenFeed',
  webDir: '.next',
  server: {
    url: 'https://app.degenfeed.xyz',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: true,
    scrollEnabled: true,
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

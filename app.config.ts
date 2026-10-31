import type { ConfigContext, ExpoConfig } from 'expo/config';

import brand from './src/config/brand.json';

/**
 * Store listing details come from the active brand, so one codebase builds a separate app per gym.
 * Switch brands with `npm run brand -- <preset>` and regenerate icons with `npm run icons`.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.name,
  slug: brand.slug,
  scheme: brand.slug,
  ios: {
    ...config.ios,
    bundleIdentifier: brand.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: brand.android.package,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      backgroundColor: brand.colors.primary,
    },
  },
  plugins: [
    'expo-router',
    // Phones are all arm64. Skipping the x86 and 32-bit builds of Skia keeps the cloud build inside its memory limit.
    ['expo-build-properties', { android: { buildArchs: ['arm64-v8a'] } }],
    [
      'expo-splash-screen',
      {
        backgroundColor: brand.colors.primary,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: `${brand.name} uses the camera at the front desk to scan member passes.`,
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
  ],
  extra: {
    ...config.extra,
    brandId: brand.id,
    ...(brand.easProjectId ? { eas: { projectId: brand.easProjectId } } : {}),
  },
});

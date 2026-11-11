import type { ConfigContext, ExpoConfig } from 'expo/config';

import brand from './src/config/brand.json';

/**
 * Store listing details come from the active brand, so one codebase builds a separate app per gym.
 * Switch brands with `npm run brand -- <preset>` and regenerate icons with `npm run icons`.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = brand.easProjectId || config.extra?.eas?.projectId;
  return {
    ...config,
    name: brand.name,
    slug: brand.slug,
    scheme: brand.slug,
    // Over-the-air updates: `npm run update` ships new JavaScript to every installed app with the same `version`.
    // Bump `version` in app.json whenever a change needs a new install (a new native library, permission, icon or splash).
    runtimeVersion: { policy: 'appVersion' },
    ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } } : {}),
    ios: {
      ...config.ios,
      bundleIdentifier: brand.ios.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: brand.android.package,
      // Lets members' alarms ring on the exact minute, once they allow it in the phone's settings.
      permissions: [...(config.android?.permissions ?? []), 'android.permission.SCHEDULE_EXACT_ALARM'],
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
      // Members' alarms. Local notifications only: no push service, nothing to pay for.
      [
        'expo-notifications',
        {
          color: brand.colors.primary,
          sounds: ['./assets/sounds/alarm.wav'],
          enableRemoteNotifications: false,
        },
      ],
    ],
    extra: {
      ...config.extra,
      brandId: brand.id,
      // Set by `npm run update -- --urgent`: phones restart into that update as soon as it downloads.
      urgentUpdate: process.env.URGENT_UPDATE === '1',
      ...(brand.easProjectId ? { eas: { projectId: brand.easProjectId } } : {}),
    },
  };
};

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json, plus the one setting that cannot live in a committed file: the
 * Android Firebase config (google-services.json) stays out of git. EAS Build
 * hands it over as the file variable GOOGLE_SERVICES_JSON (a path to it); a
 * build on this machine reads the ignored copy in the project root.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});

/**
 * Two installable variants of the same app, so both can live on one phone:
 *
 *   production  → "Blac"      com.blac.music       link scheme blac://
 *   development → "Blac Dev"  com.blac.music.dev   link scheme blac-dev://
 *
 * The variant comes from the APP_VARIANT environment variable, which the EAS build profiles set
 * (see eas.json). Everything not listed here is taken from app.json.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'Blac Dev' : config.name,
  scheme: IS_DEV ? 'blac-dev' : config.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.blac.music.dev' : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.blac.music.dev' : config.android.package,
  },
});

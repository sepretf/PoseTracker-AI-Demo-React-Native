const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Set android:hardwareAccelerated="true" on the application element.
 * (Expo schema doesn't allow hardwareAccelerated in app.json, so we use a config plugin.)
 */
function withHardwareAcceleration(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest?.application?.[0];
    if (application?.$) {
      application.$["android:hardwareAccelerated"] = "true";
    }
    return config;
  });
}

module.exports = withHardwareAcceleration;

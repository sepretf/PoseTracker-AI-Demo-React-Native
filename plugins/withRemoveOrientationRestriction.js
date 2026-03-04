const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Remove android:screenOrientation from all activities so the app supports
 * large screens and various orientations (Play Console recommendation for Android 16+).
 */
function withRemoveOrientationRestriction(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest?.application?.[0];
    if (!application?.activity) return config;

    for (const activity of application.activity) {
      if (activity?.$) {
        delete activity.$["android:screenOrientation"];
      }
    }
    return config;
  });
}

module.exports = withRemoveOrientationRestriction;

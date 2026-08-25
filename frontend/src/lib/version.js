// Single source of truth for the version shown in Settings and written into the
// Android build. Keep it in step with frontend/package.json and the versionName
// in android/app/build.gradle — scripts/sync-version.mjs checks that they match.
export const APP_VERSION = '2.0.0'

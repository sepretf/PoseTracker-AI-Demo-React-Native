## PoseTracker AI – React Native / Expo demo

This repo contains the React Native / Expo demo app used in the public **PoseTracker AI** apps:

- iOS: [PoseTracker AI on the App Store](https://apps.apple.com/us/app/posetracker-ai/id6759670702)
- Android: [PoseTracker AI on Google Play](https://play.google.com/store/apps/details?id=com.posetracker.v3demo)

It shows how to integrate the **PoseTracker V3 API** into a mobile app using:

- a `WebView` for the hosted PoseTracker UI,
- a React Native overlay for counters, grades, and jump metrics,
- camera permissions handled natively via `expo-camera`.

This codebase is meant as a **reference implementation** that developers can reuse or adapt.

### 1. Project structure

- `App.tsx` – main React Native UI and WebView integration.
- `lib/exerciseEngine.ts` – exercise registry and metadata.
- `app.json` / `eas.json` – Expo & EAS configuration (with placeholders only).
- `docs/` – integration guides.
- `developer-prompts/` – example prompts for AI agents.

### 2. Environment variables

To avoid committing credentials, the app reads the PoseTracker keys from a local `.env` file (not committed).

1. Copy the example file:

```bash
cp .env.example .env
```

2. Fill in your own values:

- `POSETRACKER_TOKEN` – your PoseTracker API token.
- `POSETRACKER_TRACKING_BASE` – PoseTracker base URL (defaults to `https://app.posetracker.com`).

3. The app uses:

- `react-native-dotenv` + `babel.config.js` to expose these as `@env`.
- `env.d.ts` to make TypeScript aware of the variables.

Your `.env` and any `eas.local.json` will never be committed thanks to the `.gitignore` rules.

### 3. EAS / store configuration

- `eas.json` in this repo only contains **placeholders** (`YOUR_APPLE_ID_EMAIL`, etc.).
- A full example with real values is kept in `eas.local.json` (git‑ignored) on your machine.
- For your own project:
  - copy `eas.json` → edit with your own Apple / Google data, **or**
  - keep a private `eas.local.json` and do not commit it.

For concrete build & submit commands, see `BUILD_AND_PUBLISH_COMMANDS.txt`.

### 4. How to run the demo locally

```bash
cd app
npm install
cp .env.example .env   # then edit values
npm run start
```

Use the standard Expo flows:

- `npm run ios` – run in iOS simulator,
- `npm run android` – run in Android emulator,
- `npm run web` – web preview (limited camera support).

### 5. Integration guides

If you want to add PoseTracker to your own React Native app, start with:

- `docs/react-native-posetracker-integration.md`
- `docs/ios-camera-permissions.md`
- `docs/POSETRACKER_JUMP_UPLOAD_INTEGRATION.txt` (advanced jump upload details).

There is also a sample AI‑agent prompt in:

- `developer-prompts/add-posetracker-to-react-native-app.md`


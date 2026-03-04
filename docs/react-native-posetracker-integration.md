## Integrating PoseTracker V3 in a React Native / Expo app

This document explains how to reproduce the core integration used in this demo, so you can plug **PoseTracker V3** into your own React Native app.

It assumes an Expo (managed) project, but most patterns also apply to bare React Native.

---

### 1. Prerequisites

- React Native / Expo app.
- `expo-camera` (for native camera permission).
- `react-native-webview` (to host the PoseTracker web UI).
- A PoseTracker API token (and optional skeleton UUID).

In this repo, those packages are already declared in `package.json`.

---

### 2. Store your PoseTracker credentials in `.env`

Instead of hard‑coding tokens in source files, we use a local `.env` file:

```bash
cp .env.example .env
```

Then fill:

- `POSETRACKER_TOKEN=...`
- `POSETRACKER_TRACKING_BASE=https://app.posetracker.com`

We use `react-native-dotenv` + `babel.config.js` to expose these as:

```ts
import {
  POSETRACKER_TOKEN,
  POSETRACKER_TRACKING_BASE,
} from "@env";
```

In this demo, `App.tsx` defines:

- `TRACKING_BASE = POSETRACKER_TRACKING_BASE`
- `TOKEN = POSETRACKER_TOKEN`

and uses them when building the WebView URL.

---

### 3. Handle camera permissions natively

PoseTracker runs inside a WebView, but **the native app must request camera access** first.

Pattern (see `App.tsx`):

1. Use `expo-camera`:

   ```ts
   const [permission, requestPermission] = useCameraPermissions();
   ```

2. Ask for permission **only when the user starts a feature that needs the camera** (e.g. Live camera mode):

   ```ts
   const ok = await ensureRealtimeCameraPermission();
   if (!ok) return;
   ```

3. If the user previously denied, show a clear message and optionally offer an **“Open Settings”** button (only after the first denial, to comply with App Store guideline 5.1.1).

---

### 4. Drive PoseTracker via a WebView

The core idea: React Native owns the chrome and overlay; PoseTracker owns the tracking UI.

1. Compute a tracking URL with all required query parameters:

   - base:
     - realtime: `${TRACKING_BASE}/pose_tracker/tracking`
     - upload: `${TRACKING_BASE}/pose_tracker/upload_tracking`
   - shared params:
     - `token` – PoseTracker API token.
     - `exercise` – exercise key (e.g. `jump_analysis`).
     - `width` / `height` – screen size in pixels.
     - `isMobile=true`.
   - upload‑mode only:
     - `source=video`
     - `skeleton=true`
     - `postureBox=false`
     - `uploadLabel=Upload a video`

   The demo uses a `useMemo` called `iframeSrc` in `App.tsx` to build this URL.

2. Render a full‑screen WebView:

   ```tsx
   <WebView
     source={{ uri: iframeSrc }}
     onMessage={onMessage}
     injectedJavaScript={jsBridge}
     javaScriptEnabled
     domStorageEnabled
     allowsInlineMediaPlayback
     mediaPlaybackRequiresUserAction={false}
     originWhitelist={["*"]}
     {...(Platform.OS === "ios" && {
       mediaCapturePermissionGrantType: "grant",
     })}
   />
   ```

3. Inject a bridge that forwards messages from PoseTracker to React Native:

   - listen to `window.message`,
   - forward payloads via `window.ReactNativeWebView.postMessage(...)`,
   - optionally expose `window.webViewCallback`.

The demo’s `jsBridge` constant and `onMessage` handler show a concrete implementation.

---

### 5. Keep tracking state in React Native

The demo drives everything from React Native state (see `App.tsx`):

- `mode: "realtime" | "upload" | null`
- `selectedExercise: string | null`
- `trackingStarted: boolean`
- `counter`, `lastFormScore`, `jumpMetrics`, etc.

Key idea: PoseTracker sends **JSON messages** with `type` fields such as:

- `counter`
- `form_score`
- `keypoints`
- `jump_height`
- `jump_summary`

The app:

- parses `event.nativeEvent.data`,
- switches on `data.type`,
- updates local state accordingly,
- renders native overlays (cards, counters, grades) on top of the WebView.

This keeps all UX and styling on the native side while leaving tracking logic to PoseTracker.

---

### 6. Jump upload integration

For a detailed, LLM‑friendly description of the jump upload flow, see:

- `POSETRACKER_JUMP_UPLOAD_INTEGRATION.txt`

It covers:

- which exercises are considered “jumps”,
- the height input wizard for `jump_analysis`,
- the exact query parameters for `/upload_tracking`,
- how to read `jump_height` and `jump_summary` messages,
- how to implement an overlay for jump metrics.

---

### 7. How to reuse this code as a template

If you want to adapt this repo to your own app:

1. Copy the pieces from `App.tsx` that manage:
   - `mode`,
   - exercise selection,
   - WebView + `iframeSrc`,
   - `onMessage` and overlays.
2. Replace the hard‑coded exercise list with your own (see `lib/exerciseEngine.ts`).
3. Point `POSETRACKER_TRACKING_BASE` at your own PoseTracker environment if needed.
4. Keep secrets out of source control by following the `.env` pattern described above.

Once this is in place, you can extend the integration with your own navigation, analytics, or backend calls while relying on PoseTracker for the heavy pose‑estimation logic.


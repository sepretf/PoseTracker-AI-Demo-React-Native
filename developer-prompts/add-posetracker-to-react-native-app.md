## Prompt: Add PoseTracker V3 to a React Native / Expo app

You are an expert React Native + Expo engineer and PoseTracker API integrator.

Your task is to integrate **PoseTracker V3** into an existing React Native / Expo app using the patterns from this reference project.

### Context

- The reference implementation lives in this repository and is already deployed as:
  - iOS: PoseTracker AI on the App Store
  - Android: PoseTracker AI on Google Play
- The core integration is described in:
  - `docs/react-native-posetracker-integration.md`
  - `POSETRACKER_JUMP_UPLOAD_INTEGRATION.txt`
- The target app should:
  - use a `WebView` for PoseTracker’s hosted UI,
  - keep counters / grades / jump metrics in React Native state,
  - request camera permission only when needed, following App Store guideline 5.1.1.

### Requirements

When you modify the target app, you must:

1. **Use environment variables**
   - Read `POSETRACKER_TOKEN` and `POSETRACKER_TRACKING_BASE` from a `.env` file (via `@env`), following the pattern used in this repo.
   - Do not hard‑code PoseTracker credentials in source files.

2. **Integrate PoseTracker via WebView**
   - Add a screen or flow similar to `App.tsx` in this repo:
     - a mode switch between “Live camera” and “Video upload” (or equivalent),
     - a list of exercises driven by an exercise registry (like `lib/exerciseEngine.ts`),
     - a full‑screen `WebView` that loads `/pose_tracker/tracking` or `/pose_tracker/upload_tracking` with the correct query parameters.
   - Inject a JS bridge and implement `onMessage` to:
     - parse JSON messages from PoseTracker,
     - update native state for counters, form grades, and jump metrics.

3. **Handle camera permissions correctly**
   - Use `expo-camera` and `useCameraPermissions()` (or the equivalent already used in the target app).
   - Request camera access only when the user starts a feature that needs it (e.g. Live camera).
   - If the user has already denied access, show a clear in‑app explanation and optionally offer an “Open Settings” button, but **never** redirect to Settings before showing the system permission dialog.

4. **Keep UX on the native side**
   - Implement native overlays (cards, labels, counters) similar to the ones in `App.tsx`.
   - Do not modify PoseTracker’s hosted UI; instead, react to the JSON events it sends.

5. **Explain all changes**
   - For each file you touch, briefly explain:
     - what you changed,
     - why it is needed for PoseTracker integration.
   - Keep explanations in English and concise so they can be copied into code review descriptions.

### Output expectations

When you finish:

- Provide a high‑level summary of the integration.
- List all new environment variables and how to set them.
- Point to the key functions / components (e.g. the equivalent of `iframeSrc`, `onMessage`, and the camera‑permission helper).


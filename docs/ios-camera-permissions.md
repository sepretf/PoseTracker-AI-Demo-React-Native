## PoseTracker – iOS camera permissions and WebView behavior

This document explains how to:

1. Request camera access correctly on iOS with `expo-camera`.
2. Avoid the extra Safari/WebView popup ("Allow posetracker.com to access the camera") on iOS 15+.
3. Stay compliant with App Store guideline 5.1.1.

---

### 1. Native camera permission (required)

PoseTracker runs inside a `WebView`, but iOS will not allow camera access until the **native app** has camera permission.

We use `expo-camera`:

- `useCameraPermissions()` to check / request access.
- `NSCameraUsageDescription` in `app.json` → `ios.infoPlist`.

In your component:

```ts
import { useCameraPermissions } from "expo-camera";

const [permission, requestPermission] = useCameraPermissions();
```

Recommended flow (used in this demo):

1. **Do not** request camera access on app launch.
2. Only request it when the user explicitly starts a feature that needs it (e.g. **Live camera**).
3. If the user denies access, explain why the camera is needed and offer an **“Open Settings”** button only when they try again.

Conceptual helper:

```ts
const ensureRealtimeCameraPermission = useCallback(async (): Promise<boolean> => {
  if (permission?.granted) return true;

  const response = await requestPermission();
  if (response?.granted) return true;

  Alert.alert(
    "Camera required",
    "Camera access is required for real-time tracking. You can enable it in your device settings if you previously denied access.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => {
          if (Linking.openSettings) {
            Linking.openSettings().catch(() => {});
          }
        },
      },
    ]
  );
  return false;
}, [permission?.granted, requestPermission]);
```

Call this helper right before entering the real-time tracking flow.

---

### 2. WebView extra camera prompt on iOS 15+

Even when the app has camera permission, iOS can show **another** prompt inside the WebView:

- “Allow posetracker.com to access the camera”

This happens because the WebView creates a web-level permission per instance.

To avoid this extra prompt on iOS 15+ while keeping the native permission in control, use the `mediaCapturePermissionGrantType` prop from `react-native-webview`:

```tsx
<WebView
  source={{ uri: posetrackerUrl }}
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

Conditions:

- iOS 15 or later.
- The native camera permission must already be granted via `expo-camera` and `NSCameraUsageDescription`.

Result:

- The system does **not** show the extra “Allow posetracker.com to access the camera” popup at each WebView mount.
- You can safely unmount/remount the WebView without re-prompting the user.

---

### 3. App Store guideline 5.1.1 considerations

To stay compliant:

- Do **not** redirect users to Settings **before** showing the system camera permission dialog.
- Request permission only when the user tries to use camera-dependent features.
- If they deny access and then try again, you can:
  - show an in-app explanation,
  - provide an optional “Open Settings” link.

This is exactly the pattern implemented in `App.tsx` in this demo app.


import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { useCameraPermissions } from "expo-camera";
import { listExercises, getExerciseInfo, type ExerciseInfo } from "./lib/exerciseEngine";
import { POSETRACKER_TOKEN, POSETRACKER_TRACKING_BASE } from "@env";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const TRACKING_BASE = POSETRACKER_TRACKING_BASE;
const POSETRACKER_BOOK_DEMO_URL = "https://www.posetracker.com/#book-demo";
const TOKEN = POSETRACKER_TOKEN;

/** Forward postMessage from the tracking page to React Native (counter + keypoints when present). */
const jsBridge = `
window.addEventListener('message', function(event) {
  window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
});

window.webViewCallback = function(data) {
  window.ReactNativeWebView.postMessage(JSON.stringify(data));
};

const originalPostMessage = window.postMessage;
window.postMessage = function(data) {
  window.ReactNativeWebView.postMessage(typeof data === 'string' ? data : JSON.stringify(data));
};

true; // Important for a correct injection
`;

type FormScore = {
  score?: number;
  avg_score?: number;
  grade?: string;
};

type TrackingMode = "realtime" | "upload" | null;

type HeightUnit = "cm" | "ft_in";

type JumpMetrics = {
  lastHeightCm?: number;
  lastAirTimeSeconds?: number;
};

/** Single keypoint from PoseTracker keypoints event. */
export type Keypoint = {
  name: string;
  score: number;
  x: number;
  y: number;
  z: number;
};

/** Payload of keypoints event: { type: "keypoints", data: Keypoint[] }. */
export type KeypointsPayload = Keypoint[];

const isJumpExercise = (key: string | null) =>
  key === "jump_analysis" || key === "air_time_jump";

/** Only jump_analysis requires user height (cm); air_time_jump uses physics. */
const requiresUserHeight = (key: string | null) => key === "jump_analysis";

const isSmallScreen = (w: number) => w < 380;

// Safe area: Android status bar + optional nav bar; iOS handled with larger padding
const getSafeTop = () => {
  if (Platform.OS === "android") {
    const statusBarHeight = typeof RNStatusBar.currentHeight === "number" ? RNStatusBar.currentHeight : 24;
    return statusBarHeight + 12;
  }
  return 50;
};
const getSafeBottom = () => (Platform.OS === "android" ? 24 : 34);

export default function App() {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const small = isSmallScreen(winWidth);
  const safeTop = getSafeTop();
  const safeBottom = getSafeBottom();
  const minContentHeight = winHeight - safeTop - safeBottom;
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<TrackingMode>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [counter, setCounter] = useState<number | null>(null);
  const [lastFormScore, setLastFormScore] = useState<FormScore | null>(null);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [heightCmInput, setHeightCmInput] = useState<string>("");
  const [heightFeetInput, setHeightFeetInput] = useState<string>("");
  const [heightInchesInput, setHeightInchesInput] = useState<string>("");
  const [userHeightCm, setUserHeightCm] = useState<number | null>(null);
  const [jumpMetrics, setJumpMetrics] = useState<JumpMetrics | null>(null);
  const keypointsRef = useRef<KeypointsPayload | null>(null);

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
            // Allowed by App Store once the user already tried to use the feature.
            if (Linking.openSettings) {
              Linking.openSettings().catch(() => {});
            }
          },
        },
      ]
    );
    return false;
  }, [permission?.granted, requestPermission]);

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("[PoseTracker] data:", JSON.stringify(data));
      if (!data) return;

      if (data.type === "counter") {
        setCounter(data.current_count ?? null);
        if (data.form_score) {
          setLastFormScore({
            score: data.form_score.score,
            avg_score: data.form_score.avg_score,
            grade: data.form_score.grade ?? "—",
          });
        }
      } else if (data.type === "keypoints" && Array.isArray(data.data)) {
        const keypoints: KeypointsPayload = data.data;
        keypointsRef.current = keypoints;
        //console.log("[PoseTracker] keypoints:", JSON.stringify(keypoints));
      } else if (data.type === "jump_height") {
        setJumpMetrics((prev) => ({
          ...prev,
          lastHeightCm:
            typeof data.jumpHeightCm === "number"
              ? data.jumpHeightCm
              : prev?.lastHeightCm,
          lastAirTimeSeconds:
            typeof data.airTimeSeconds === "number"
              ? data.airTimeSeconds
              : prev?.lastAirTimeSeconds,
        }));
      } else if (data.type === "jump_summary") {
        setJumpMetrics((prev) => ({
          ...prev,
          lastHeightCm:
            typeof data.maxJumpHeight === "number"
              ? data.maxJumpHeight
              : prev?.lastHeightCm,
        }));
      }
    } catch (_) {}
  }, []);

  const resetTrackingState = useCallback(() => {
    setCounter(null);
    setLastFormScore(null);
    setSelectedExercise(null);
    setTrackingStarted(false);
    setUserHeightCm(null);
    setJumpMetrics(null);
  }, []);

  const handleSelectExercise = useCallback(
    async (exerciseKey: string) => {
      if (!mode) return;

      if (mode === "realtime") {
        const ok = await ensureRealtimeCameraPermission();
        if (!ok) return;
      }

      setCounter(null);
      setLastFormScore(null);
      setUserHeightCm(null);
      setJumpMetrics(null);
      setSelectedExercise(exerciseKey);

      if (requiresUserHeight(exerciseKey)) {
        setTrackingStarted(false);
      } else {
        setTrackingStarted(true);
      }
    },
    [mode, ensureRealtimeCameraPermission]
  );

  const exercises = useMemo(() => {
    const keys = listExercises();
    return keys.map((key) => getExerciseInfo(key)!);
  }, []);

  const computeHeightCm = useCallback((): number | null => {
    if (!requiresUserHeight(selectedExercise)) return null;

    if (heightUnit === "cm") {
      const v = parseFloat(heightCmInput.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) return null;
      return v;
    }

    const feet = parseFloat(heightFeetInput.replace(",", "."));
    const inches = parseFloat(heightInchesInput.replace(",", "."));
    if (!Number.isFinite(feet) || feet < 0) return null;
    if (!Number.isFinite(inches) || inches < 0) return null;
    const totalInches = feet * 12 + inches;
    if (totalInches <= 0) return null;
    const cm = totalInches * 2.54;
    return cm;
  }, [heightUnit, heightCmInput, heightFeetInput, heightInchesInput, selectedExercise]);

  const hasValidHeight = useMemo(
    () => (requiresUserHeight(selectedExercise) ? !!computeHeightCm() : true),
    [computeHeightCm, selectedExercise]
  );

  const handleStartJumpTracking = useCallback(() => {
    if (!requiresUserHeight(selectedExercise)) {
      setTrackingStarted(true);
      return;
    }
    const cm = computeHeightCm();
    if (!cm) return;
    setUserHeightCm(cm);
    setTrackingStarted(true);
  }, [computeHeightCm, selectedExercise]);

  const iframeSrc = useMemo(() => {
    if (!selectedExercise || !mode) return null;
    const params = new URLSearchParams();
    params.set("token", TOKEN);
    params.set("exercise", selectedExercise);

    // Shared params (tracking + upload), see PoseTracker docs:
    // https://posetracker.gitbook.io/posetracker-api/shared-query-parameters-tracking-+-upload-tracking
    //params.set("keypoints", "true");
    params.set("width", String(Math.round(SCREEN_WIDTH)));
    params.set("height", String(Math.round(SCREEN_HEIGHT)));
    params.set("isMobile", "true");

    // userHeightCm required only for jump_analysis (air_time_jump uses air time, no height).
    if (requiresUserHeight(selectedExercise) && userHeightCm != null) {
      params.set("userHeightCm", String(Math.round(userHeightCm)));
    }

    let baseUrl = `${TRACKING_BASE}/pose_tracker/tracking`;

    if (mode === "realtime") {
      // Real-time camera tracking
      params.set("postureBox", "true");
      params.set("placementBoxStrokeColor", "#4DD21D");
      params.set("placement", "1");
      params.set("placementCountdownSeconds", "3");
    } else {
      // Upload Tracking on video
      // Reference: https://posetracker.gitbook.io/posetracker-api/use-posetracker-on-uploaded-files/upload-tracking-endpoint-video-and-image
      baseUrl = `${TRACKING_BASE}/pose_tracker/upload_tracking`;
      params.set("source", "video");
      params.set("skeleton", "true");
      params.set("postureBox", "false");
      params.set("uploadLabel", "Upload a video");
    }

    return `${baseUrl}?${params.toString()}`;
  }, [mode, selectedExercise, userHeightCm]);

  const exerciseInfo = selectedExercise ? getExerciseInfo(selectedExercise) : null;
  const isStatic = exerciseInfo?.movement_type === "static";
  const showHeightStep = requiresUserHeight(selectedExercise) && !trackingStarted;
  const isJumpOverlay = isJumpExercise(selectedExercise);

  const gradeColor = useMemo(() => {
    const g = lastFormScore?.grade;
    if (!g || g === "—") return "#94a3b8";
    switch (g) {
      case "A": return "#22c55e";
      case "B": return "#3b82f6";
      case "C": return "#eab308";
      case "D": return "#f97316";
      case "E": return "#ef4444";
      default: return "#94a3b8";
    }
  }, [lastFormScore?.grade]);

  const openPoseTrackerSite = useCallback(() => {
    Linking.openURL(POSETRACKER_BOOK_DEMO_URL).catch(() => {});
  }, []);

  if (trackingStarted && selectedExercise && iframeSrc) {
    return (
      <View style={styles.trackingContainer}>
        <StatusBar style="light" />
        <WebView
          source={{ uri: iframeSrc }}
          style={styles.webview}
          onMessage={onMessage}
          injectedJavaScript={jsBridge}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={["*"]}
          {...(Platform.OS === "android" && {
            mixedContentMode: "compatibility",
            androidLayerType: "hardware",
          })}
          {...(Platform.OS === "ios" && {
            mediaCapturePermissionGrantType: "grant",
          })}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("[PoseTracker] WebView error:", nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn("[PoseTracker] WebView HTTP error:", nativeEvent.statusCode, nativeEvent.description);
          }}
          startInLoadingState
        />
        {/* Overlay: back top-left; bottom cards depend on exercise type (jump vs rep/duration) */}
        <View style={styles.overlay} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.backButton, { top: safeTop }]}
            onPress={resetTrackingState}
            activeOpacity={0.8}
            accessibilityLabel="Back to exercise selection"
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <View style={[styles.bottomCards, { bottom: safeBottom }]} pointerEvents="box-none">
            {isJumpOverlay ? (
              <>
                <View style={[styles.gradeCard, styles.gradeCardPosition]}>
                  <Text
                    style={styles.gradeLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    Air time
                  </Text>
                  <Text
                    style={[styles.gradeValue, { color: "#e5e7eb" }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {jumpMetrics?.lastAirTimeSeconds != null
                      ? `${jumpMetrics.lastAirTimeSeconds.toFixed(2)} s`
                      : "—"}
                  </Text>
                </View>
                <View style={[styles.counterCard, styles.counterCardPosition]}>
                  <Text
                    style={styles.gradeLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    Jump height
                  </Text>
                  <Text
                    style={styles.counterValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {jumpMetrics?.lastHeightCm != null
                      ? `${jumpMetrics.lastHeightCm.toFixed(1)}`
                      : "—"}
                  </Text>
                  <Text style={styles.counterUnit} numberOfLines={1}>
                    cm
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.gradeCard, styles.gradeCardPosition]}>
                  <Text
                    style={styles.gradeLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    Last rep
                  </Text>
                  <Text
                    style={[styles.gradeValue, { color: gradeColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {lastFormScore?.grade && lastFormScore.grade !== "—" ? lastFormScore.grade : "—"}
                  </Text>
                </View>
                <View style={[styles.counterCard, styles.counterCardPosition]}>
                  <Text
                    style={styles.counterValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {counter != null ? counter : "0"}
                  </Text>
                  <Text style={styles.counterUnit} numberOfLines={1}>
                    {isStatic ? "sec" : "rep(s)"}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainScrollContent,
          {
            paddingTop: safeTop,
            paddingBottom: safeBottom,
            minHeight: minContentHeight,
          },
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.brandRow}
            onPress={openPoseTrackerSite}
            activeOpacity={0.85}
            accessibilityLabel="PoseTracker – open website"
            accessibilityRole="link"
          >
            <Image
              source={require("./assets/icon.png")}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text
              style={[styles.title, small && styles.titleSmall]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              PoseTracker Demo App
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.subtitle, small && styles.subtitleSmall]}
            numberOfLines={5}
            allowFontScaling
          >
            We help mobile apps use real-time pose estimation.{"\n"}
            Built by developers, for developers.{"\n\n"}
            You can test our tech on this app ⬇️
          </Text>
        </View>
        {!mode ? (
          <View style={styles.modeSelectionContainer}>
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardPrimary]}
              onPress={() => setMode("realtime")}
              activeOpacity={0.9}
            >
              <View style={styles.modeCardInner}>
                <Text style={[styles.modeCardIcon, small && styles.modeCardIconSmall]}>📷</Text>
                <Text
                  style={[styles.modeLabel, small && styles.modeLabelSmall]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  Live camera
                </Text>
                <Text
                  style={[styles.modeDescription, small && styles.modeDescriptionSmall]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  Real-time tracking with your camera
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => setMode("upload")}
              activeOpacity={0.9}
            >
              <View style={styles.modeCardInner}>
                <Text style={[styles.modeCardIcon, small && styles.modeCardIconSmall]}>🖼️</Text>
                <Text
                  style={[styles.modeLabel, small && styles.modeLabelSmall]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  Video upload
                </Text>
                <Text
                  style={[styles.modeDescription, small && styles.modeDescriptionSmall]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  Analyze a recorded workout video
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardCta]}
              onPress={() => Linking.openURL("https://www.posetracker.com/")}
              activeOpacity={0.9}
            >
              <View style={styles.modeCardInner}>
                <Text style={[styles.modeCardIcon, small && styles.modeCardIconSmall]}>🚀</Text>
                <Text
                  style={[styles.modeLabel, small && styles.modeLabelSmall]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  Start using our API
                </Text>
                <Text
                  style={[styles.modeDescription, small && styles.modeDescriptionSmall]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  Add Pose Estimation features to your app for free.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
        <>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeToggleChip,
                mode === "realtime" && styles.modeToggleChipActive,
              ]}
              onPress={() => setMode("realtime")}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  mode === "realtime" && styles.modeToggleTextActive,
                ]}
              >
                Live camera
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleChip,
                mode === "upload" && styles.modeToggleChipActive,
              ]}
              onPress={() => setMode("upload")}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  mode === "upload" && styles.modeToggleTextActive,
                ]}
              >
                Video upload
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.key}
                exercise={ex}
                onPress={() => handleSelectExercise(ex.key)}
              />
            ))}
          </ScrollView>
          {showHeightStep && (
            <View style={styles.heightCard}>
              <Text style={styles.heightTitle} numberOfLines={1}>
                Your height
              </Text>
              <Text style={styles.heightSubtitle} numberOfLines={2}>
                Required for jump_analysis (scale from your height)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.heightUnitRow}
              >
                <TouchableOpacity
                  style={[
                    styles.heightUnitChip,
                    heightUnit === "cm" && styles.heightUnitChipActive,
                  ]}
                  onPress={() => setHeightUnit("cm")}
                >
                  <Text
                    style={[
                      styles.heightUnitText,
                      heightUnit === "cm" && styles.heightUnitTextActive,
                    ]}
                  >
                    cm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.heightUnitChip,
                    heightUnit === "ft_in" && styles.heightUnitChipActive,
                  ]}
                  onPress={() => setHeightUnit("ft_in")}
                >
                  <Text
                    style={[
                      styles.heightUnitText,
                      heightUnit === "ft_in" && styles.heightUnitTextActive,
                    ]}
                  >
                    ft / in
                  </Text>
                </TouchableOpacity>
              </ScrollView>
              {heightUnit === "cm" ? (
                <View style={styles.heightRow}>
                  <TextInput
                    style={styles.heightInput}
                    value={heightCmInput}
                    onChangeText={setHeightCmInput}
                    placeholder="170"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                  />
                  <Text style={styles.heightUnitLabel}>cm</Text>
                </View>
              ) : (
                <View style={styles.heightRow}>
                  <View style={styles.heightHalf}>
                    <TextInput
                      style={styles.heightInput}
                      value={heightFeetInput}
                      onChangeText={setHeightFeetInput}
                      placeholder="5"
                      placeholderTextColor="#6b7280"
                      keyboardType="numeric"
                    />
                    <Text style={styles.heightUnitLabel}>ft</Text>
                  </View>
                  <View style={styles.heightHalf}>
                    <TextInput
                      style={styles.heightInput}
                      value={heightInchesInput}
                      onChangeText={setHeightInchesInput}
                      placeholder="9"
                      placeholderTextColor="#6b7280"
                      keyboardType="numeric"
                    />
                    <Text style={styles.heightUnitLabel}>in</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.startButton,
                  !hasValidHeight && styles.startButtonDisabled,
                ]}
                onPress={handleStartJumpTracking}
                activeOpacity={hasValidHeight ? 0.9 : 1}
                disabled={!hasValidHeight}
              >
                <Text style={styles.startButtonText} numberOfLines={1}>
                  {mode === "realtime" ? "Start live jump" : "Start video jump"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      </ScrollView>
    </View>
  );
}

function ExerciseCard({ exercise, onPress }: { exercise: ExerciseInfo; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardImagePlaceholder}>
        <Text style={styles.cardIcon}>🏃</Text>
      </View>
      <View style={styles.cardContent}>
        <Text
          style={styles.cardTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {exercise.name}
        </Text>
        {exercise.movement_type ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {exercise.movement_type}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  safeTop: {
    paddingTop: Platform.OS === "ios" ? 50 : 40,
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 4,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f8fafc",
    maxWidth: "100%",
  },
  titleSmall: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 6,
    maxWidth: "100%",
  },
  subtitleSmall: {
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  modeSelectionContainer: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
    maxWidth: "100%",
  },
  modeCard: {
    flex: 1,
    minHeight: 80,
    width: "100%",
    maxWidth: "100%",
    borderRadius: 20,
    backgroundColor: "#111827",
    borderWidth: 2,
    borderColor: "#374151",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modeCardInner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  modeCardPrimary: {
    backgroundColor: "#1d283a",
    borderColor: "#3b82f6",
  },
  modeCardCta: {
    backgroundColor: "#111827",
    borderColor: "#3b82f6",
  },
  modeCardIcon: {
    fontSize: 48,
    marginBottom: 6,
    textAlign: "center",
  },
  modeCardIconSmall: {
    fontSize: 40,
    marginBottom: 4,
  },
  modeLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 4,
    textAlign: "center",
    maxWidth: "100%",
  },
  modeLabelSmall: {
    fontSize: 16,
  },
  modeDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingHorizontal: 6,
    maxWidth: "100%",
  },
  modeDescriptionSmall: {
    fontSize: 12,
    paddingHorizontal: 2,
  },
  modeToggle: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  modeToggleChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#111827",
  },
  modeToggleChipActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#1d283a",
  },
  modeToggleText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  modeToggleTextActive: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  card: {
    width: "48%",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    overflow: "hidden",
  },
  cardImagePlaceholder: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  cardIcon: {
    fontSize: 40,
  },
  cardContent: {
    padding: 12,
    minHeight: 52,
    justifyContent: "center",
    overflow: "hidden",
    maxWidth: "100%",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8fafc",
    maxWidth: "100%",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    textTransform: "capitalize",
    marginTop: 2,
    maxWidth: "100%",
  },
  trackingContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(42,42,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: {
    fontSize: 28,
    color: "#f8fafc",
    fontWeight: "300",
    marginTop: -2,
  },
  bottomCards: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  gradeCard: {
    minWidth: 80,
    maxWidth: "48%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(42,42,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.8)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gradeCardPosition: {},
  gradeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 4,
  },
  gradeValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  counterCard: {
    width: 110,
    height: 110,
    maxWidth: "48%",
    borderRadius: 12,
    backgroundColor: "rgba(42,42,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    overflow: "hidden",
  },
  counterCardPosition: {},
  counterValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#f8fafc",
  },
  counterUnit: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  heightCard: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    paddingTop: 8,
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  heightTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  heightSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  heightUnitRow: {
    marginTop: 12,
    gap: 8,
  },
  heightUnitChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#020617",
    marginRight: 8,
  },
  heightUnitChipActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#1d283a",
  },
  heightUnitText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  heightUnitTextActive: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  heightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  heightHalf: {
    flex: 1,
  },
  heightInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#020617",
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: "#e5e7eb",
    fontSize: 14,
  },
  heightUnitLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  startButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonDisabled: {
    backgroundColor: "#1f2937",
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f9fafb",
  },
});

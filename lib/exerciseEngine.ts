/**
 * PoseTracker V3 – exercise list and metadata.
 * All official V3 exercises from the PoseTracker EXERCISE docs are exposed here:
 * https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=squat
 *
 * Includes:
 * - dynamic (repetition) exercises
 * - static (duration) exercises
 * - custom flows (jump_analysis, air_time_jump)
 *
 * Legacy aliases (face_squat, face_pushup) are intentionally not listed,
 * as they map to squat and push_up and are kept only for backward compatibility.
 */

export type MovementType = "dynamic" | "static";

export interface ExerciseInfo {
  key: string;
  name: string;
  movement_type?: MovementType;
  type: "base" | "custom";
  imageUrl?: string;
}

const EXERCISES: ExerciseInfo[] = [
  // Repetition (dynamic)
  { key: "squat", name: "Squat", movement_type: "dynamic", type: "base" },
  { key: "push_up", name: "Push-up", movement_type: "dynamic", type: "base" },
  { key: "lunge", name: "Lunge", movement_type: "dynamic", type: "base" },
  { key: "side_lunge", name: "Side lunge", movement_type: "dynamic", type: "base" },
  { key: "deadlift", name: "Deadlift", movement_type: "dynamic", type: "base" },
  { key: "bicep_curl", name: "Bicep curl", movement_type: "dynamic", type: "base" },
  { key: "hammer_curl", name: "Hammer curl", movement_type: "dynamic", type: "base" },
  { key: "tricep_dip", name: "Tricep dip", movement_type: "dynamic", type: "base" },
  { key: "shoulder_press", name: "Shoulder press", movement_type: "dynamic", type: "base" },
  { key: "lateral_raise", name: "Lateral raise", movement_type: "dynamic", type: "base" },
  { key: "glute_bridge", name: "Glute bridge", movement_type: "dynamic", type: "base" },
  { key: "calf_raise", name: "Calf raise", movement_type: "dynamic", type: "base" },
  { key: "mountain_climber", name: "Mountain climber", movement_type: "dynamic", type: "base" },
  { key: "high_knees", name: "High knees", movement_type: "dynamic", type: "base" },
  { key: "jumping_jack", name: "Jumping jack", movement_type: "dynamic", type: "base" },
  { key: "leg_raise", name: "Leg raise", movement_type: "dynamic", type: "base" },
  { key: "low_impact_jack", name: "Low-impact jack", movement_type: "dynamic", type: "base" },

  // Duration (static)
  { key: "plank", name: "Plank", movement_type: "static", type: "base" },
  { key: "wall_sit", name: "Wall sit", movement_type: "static", type: "base" },
  { key: "balance_leg", name: "Balance (single leg)", movement_type: "static", type: "base" },
  { key: "balance_leg_left", name: "Balance (left leg)", movement_type: "static", type: "base" },
  { key: "balance_leg_right", name: "Balance (right leg)", movement_type: "static", type: "base" },

  // Custom flows
  { key: "jump_analysis", name: "Jump analysis", movement_type: "dynamic", type: "custom" },
  { key: "air_time_jump", name: "Air-time jump", movement_type: "dynamic", type: "custom" },
];

/** Returns all official exercise keys (dynamic, static and custom). */
export function listExercises(): string[] {
  return EXERCISES.map((ex) => ex.key);
}

export function getExerciseInfo(key: string): ExerciseInfo | null {
  const ex = EXERCISES.find((e) => e.key === key) ?? null;
  return ex;
}

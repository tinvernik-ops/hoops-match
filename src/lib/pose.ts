import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

// MediaPipe pose landmark indices
export const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
} as const;

export function angleDeg(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export type FormMetrics = {
  frames: number;
  maxElbowAngle: number;   // peak extension at release (degrees)
  minKneeAngle: number;    // deepest knee bend (smaller = deeper)
  releaseWristHeight: number; // normalized: lower y = higher hand
  followThroughMs: number; // time wrist stayed above shoulder
};

export function emptyMetrics(): FormMetrics {
  return { frames: 0, maxElbowAngle: 0, minKneeAngle: 180, releaseWristHeight: 1, followThroughMs: 0 };
}

export function scoreForm(m: FormMetrics): { score: number; notes: string[] } {
  const notes: string[] = [];
  let s = 0;
  // Elbow extension at release: ideal 160-175°
  if (m.maxElbowAngle >= 160) { s += 30; }
  else if (m.maxElbowAngle >= 140) { s += 20; notes.push("Extend your shooting arm more on release."); }
  else { s += 10; notes.push("Bent elbow — drive through and snap the wrist."); }

  // Knee bend: ideal min ~110-130°
  if (m.minKneeAngle <= 135 && m.minKneeAngle >= 95) { s += 30; }
  else if (m.minKneeAngle < 95) { s += 18; notes.push("Too much knee bend — costs balance."); }
  else { s += 15; notes.push("Bend your knees more to load power."); }

  // Release height: lower y = higher (0..1)
  if (m.releaseWristHeight <= 0.25) { s += 25; }
  else if (m.releaseWristHeight <= 0.4) { s += 18; notes.push("Try a higher release point."); }
  else { s += 10; notes.push("Release is low — easier to block."); }

  // Follow-through
  if (m.followThroughMs >= 350) { s += 15; }
  else if (m.followThroughMs >= 180) { s += 10; notes.push("Hold the follow-through longer."); }
  else { s += 5; notes.push("No follow-through detected."); }

  if (notes.length === 0) notes.push("Clean form. Keep it up.");
  return { score: Math.min(100, s), notes };
}

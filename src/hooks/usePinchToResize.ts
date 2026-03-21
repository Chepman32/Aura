import { useSharedValue } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export type ColumnCount = 2 | 3 | 4;

const MIN_COLUMNS: ColumnCount = 2;
const MAX_COLUMNS: ColumnCount = 4;
const DEFAULT_COLUMNS: ColumnCount = 3;

/**
 * Pinch threshold — how much the scale has to move from the last commit
 * before the column count changes. Tuned so accidental micro-pinches don't
 * trigger a layout change.
 */
const SCALE_THRESHOLD = 0.25;

interface UsePinchToResizeResult {
  /** Current column count as a Reanimated shared value. */
  columns: SharedValue<ColumnCount>;
  /** Composed gesture to attach to a GestureDetector. */
  pinchGesture: ReturnType<typeof Gesture.Pinch>;
}

interface UsePinchToResizeOptions {
  defaultColumns?: ColumnCount;
}

/**
 * Drives a column-count grid layout via a pinch gesture.
 *
 * Pinch OUT (scale > 1) → fewer columns (cells grow larger).
 * Pinch IN  (scale < 1) → more columns (cells shrink).
 *
 * Column count is clamped to [2, 4] and is committed discretely:
 * every time the accumulated scale delta crosses the threshold the count
 * steps by ±1 and the baseline resets. This avoids jumpy multi-step
 * changes in a single gesture.
 */
export function usePinchToResize(
  options?: UsePinchToResizeOptions,
): UsePinchToResizeResult {
  const columns = useSharedValue<ColumnCount>(
    options?.defaultColumns ?? DEFAULT_COLUMNS,
  );

  // Tracks the scale at the last commit so we can measure relative movement.
  const baseScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      baseScale.value = 1;
    })
    .onUpdate((event) => {
      const delta = event.scale - baseScale.value;

      if (delta > SCALE_THRESHOLD) {
        // Pinch OUT — fewer columns
        const next = (columns.value - 1) as ColumnCount;
        if (next >= MIN_COLUMNS) {
          columns.value = next;
        }
        baseScale.value = event.scale;
      } else if (delta < -SCALE_THRESHOLD) {
        // Pinch IN — more columns
        const next = (columns.value + 1) as ColumnCount;
        if (next <= MAX_COLUMNS) {
          columns.value = next;
        }
        baseScale.value = event.scale;
      }
    })
    .onEnd(() => {
      baseScale.value = 1;
    });

  return { columns, pinchGesture };
}

import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

const OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * Triggers a light impact haptic — used for scrolling through filters.
 */
export function light(): void {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactLight, OPTIONS);
}

/**
 * Triggers a medium impact haptic — used for snapping to markers or 0-point.
 */
export function medium(): void {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactMedium, OPTIONS);
}

/**
 * Triggers a heavy impact haptic — used for export completion or deletion.
 */
export function heavy(): void {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactHeavy, OPTIONS);
}

export const useHaptics = () => ({ light, medium, heavy });

import { useMemo } from 'react';
import { getColorMatrix, IDENTITY_MATRIX } from '../filters/colorMatrices';

/**
 * Returns a 4×5 color matrix (20 values) that is a linear interpolation
 * between the identity matrix and the filter's own matrix.
 *
 * At intensity 0.0 the result equals the identity (no effect).
 * At intensity 1.0 the result equals the filter matrix (full effect).
 * Values between produce a proportional blend.
 *
 * The computation is memoized — a new array is produced only when
 * filterId or intensity changes.
 *
 * @param filterId  - Key for the filter in colorMatrices.ts.
 * @param intensity - Blend factor in [0.0, 1.0].
 */
export function useFilterPreview(
  filterId: string,
  intensity: number,
): number[] {
  return useMemo(() => {
    const filterMatrix = getColorMatrix(filterId);
    const clampedIntensity = Math.min(1, Math.max(0, intensity));

    // Short-circuit the identity case — avoids allocating a new array
    // when no filter is applied.
    if (clampedIntensity === 0 || filterId === 'original') {
      return IDENTITY_MATRIX;
    }

    if (clampedIntensity === 1) {
      return filterMatrix;
    }

    // Linear interpolation: identity * (1 - t) + filter * t
    return IDENTITY_MATRIX.map(
      (identityValue, index) =>
        identityValue * (1 - clampedIntensity) +
        filterMatrix[index] * clampedIntensity,
    );
  }, [filterId, intensity]);
}

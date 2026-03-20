import { Filter } from './types';
import { COLOR_MATRICES } from './colorMatrices';

// ---------------------------------------------------------------------------
// Filter catalogue
// ---------------------------------------------------------------------------

/**
 * The ordered list of all available filters.
 * Order determines the carousel sequence in the UI.
 */
export const FILTERS: Filter[] = [
  {
    id: 'original',
    name: 'Original',
    dominantColor: '#FFFFFF',
    colorMatrix: COLOR_MATRICES.original,
    lutFile: null,
  },
  {
    id: 'vintage',
    name: 'Vintage',
    dominantColor: '#D4A574',
    colorMatrix: COLOR_MATRICES.vintage,
    lutFile: 'vintage.cube',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    dominantColor: '#1A6B8A',
    colorMatrix: COLOR_MATRICES.cinematic,
    lutFile: 'cinematic.cube',
  },
  {
    id: 'noir',
    name: 'Noir',
    dominantColor: '#666666',
    colorMatrix: COLOR_MATRICES.noir,
    lutFile: 'noir.cube',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    dominantColor: '#87CEEB',
    colorMatrix: COLOR_MATRICES.arctic,
    lutFile: 'arctic.cube',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    dominantColor: '#FF6B35',
    colorMatrix: COLOR_MATRICES.sunset,
    lutFile: 'sunset.cube',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    dominantColor: '#2ECC71',
    colorMatrix: COLOR_MATRICES.emerald,
    lutFile: 'emerald.cube',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    dominantColor: '#9B59B6',
    colorMatrix: COLOR_MATRICES.lavender,
    lutFile: 'lavender.cube',
  },
  {
    id: 'bleach',
    name: 'Bleach',
    dominantColor: '#C0C0C0',
    colorMatrix: COLOR_MATRICES.bleach,
    lutFile: 'bleach.cube',
  },
  {
    id: 'sketch',
    name: 'Sketch',
    dominantColor: '#E8E8E8',
    colorMatrix: COLOR_MATRICES.sketch,
    lutFile: null,
  },
];

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Returns the Filter matching the given id, or undefined if not found.
 */
export function getFilterById(id: string): Filter | undefined {
  return FILTERS.find(f => f.id === id);
}

/**
 * Returns the filters immediately before and after the filter with the given id
 * in the FILTERS array. Returns null for prev/next when at the boundary.
 *
 * Returns { prev: null, next: null } when the id is not found.
 */
export function getAdjacentFilters(
  id: string,
): { prev: Filter | null; next: Filter | null } {
  const index = FILTERS.findIndex(f => f.id === id);

  if (index === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: index > 0 ? FILTERS[index - 1] : null,
    next: index < FILTERS.length - 1 ? FILTERS[index + 1] : null,
  };
}

// Re-export types and colour-matrix utilities for convenience.
export type { Filter } from './types';
export { COLOR_MATRICES, IDENTITY_MATRIX, getColorMatrix } from './colorMatrices';

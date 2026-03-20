/**
 * Color matrices for video filter effects.
 *
 * Each matrix is 20 values in row-major order for a 4x5 RGBA color transform:
 *
 *   [ R_r, R_g, R_b, R_a, R_offset,
 *     G_r, G_g, G_b, G_a, G_offset,
 *     B_r, B_g, B_b, B_a, B_offset,
 *     A_r, A_g, A_b, A_a, A_offset ]
 *
 * Where the output channel is computed as:
 *   R_out = R_r*R + R_g*G + R_b*B + R_a*A + R_offset
 *   G_out = G_r*R + G_g*G + G_b*B + G_a*A + G_offset
 *   B_out = B_r*R + B_g*G + B_b*B + B_a*A + B_offset
 *   A_out = A_r*R + A_g*G + A_b*B + A_a*A + A_offset
 *
 * Offsets are in [0,1] normalized space (divide by 255 when using integer APIs).
 */

// ---------------------------------------------------------------------------
// Identity — no transformation
// ---------------------------------------------------------------------------
export const IDENTITY_MATRIX: number[] = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

// ---------------------------------------------------------------------------
// Filter matrices
// ---------------------------------------------------------------------------
export const COLOR_MATRICES: Record<string, number[]> = {
  /**
   * original — pass-through identity.
   */
  original: [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /**
   * vintage — warm sepia with faded blacks.
   * Desaturates via luminance weights, maps to warm amber/brown tones,
   * and lifts shadows slightly to simulate aged film.
   */
  vintage: [
    0.393, 0.769, 0.189, 0, 0.020,
    0.349, 0.686, 0.168, 0, 0.005,
    0.272, 0.534, 0.131, 0, -0.010,
    0,     0,     0,     1, 0,
  ],

  /**
   * cinematic — teal-orange (Hollywood blockbuster grade).
   * Shadows pushed toward teal/cyan, highlights warmed toward orange.
   * Achieved by boosting B in darks via offset, lifting R, and
   * cross-talking R channel into the B channel to steal warmth from
   * highlights proportionally.
   */
  cinematic: [
    1.08,  0.05, -0.10, 0,  0.02,
   -0.03,  0.95,  0.05, 0, -0.01,
   -0.08,  0.10,  1.12, 0,  0.06,
    0,     0,     0,    1,  0,
  ],

  /**
   * noir — heavy desaturation with mild contrast boost.
   * Uses luminance-weighted desaturation (ITU-R BT.709 luma coefficients)
   * and a slight S-curve approximated by scaling around 0.5.
   */
  noir: [
    0.2126, 0.7152, 0.0722, 0, -0.02,
    0.2126, 0.7152, 0.0722, 0, -0.02,
    0.2126, 0.7152, 0.0722, 0, -0.02,
    0,      0,      0,      1,  0,
  ],

  /**
   * arctic — cool blue-tinted with lifted exposure.
   * Reds pulled back, blues boosted, overall brightness raised to evoke
   * ice and open sky.
   */
  arctic: [
    0.85,  0.02, -0.02, 0,  0.02,
    0.02,  0.92,  0.06, 0,  0.03,
    0.05,  0.05,  1.18, 0,  0.05,
    0,     0,     0,    1,  0,
  ],

  /**
   * sunset — warm orange-amber shift.
   * Reds and greens boosted, blues significantly reduced.
   * Offset adds a warm lift to blacks (prevents crushed shadows).
   */
  sunset: [
    1.20,  0.10, -0.05, 0,  0.04,
    0.05,  1.00, -0.08, 0,  0.01,
   -0.15, -0.05,  0.70, 0, -0.02,
    0,     0,     0,    1,  0,
  ],

  /**
   * emerald — lush green tint with slight cyan shadow.
   * Greens strongly boosted, reds pulled back, blues shifted toward cyan.
   */
  emerald: [
    0.78,  0.05,  0.02, 0, -0.01,
    0.10,  1.15,  0.05, 0,  0.04,
   -0.05,  0.08,  0.90, 0,  0.03,
    0,     0,     0,    1,  0,
  ],

  /**
   * lavender — dreamy purple-pink shift.
   * Reds and blues both boosted, greens reduced, slight magenta offset.
   */
  lavender: [
    1.10,  0.00,  0.08, 0,  0.03,
   -0.05,  0.85, -0.02, 0, -0.01,
    0.08, -0.02,  1.10, 0,  0.04,
    0,     0,     0,    1,  0,
  ],

  /**
   * bleach — bleach bypass look.
   * Partial desaturation via luminance mixing (retains ~50% color),
   * high contrast (scale > 1) and slightly lifted blacks for the
   * characteristic overexposed-but-gritty feel.
   */
  bleach: [
    0.714, 0.286, 0.072, 0, -0.03,
    0.107, 0.786, 0.072, 0, -0.03,
    0.107, 0.286, 0.786, 0, -0.03,
    0,     0,     0,     1,  0,
  ],

  /**
   * vhs — washed-out colour grade fallback for non-native paths.
   */
  vhs: [
    0.60, 0.30, 0.10, 0, 0.02,
    0.10, 0.70, 0.20, 0, 0.01,
    0.10, 0.20, 0.60, 0, -0.01,
    0,    0,    0,    1,  0,
  ],

  /**
   * sketch — grayscale fallback approximation for non-native preview paths.
   * The real iOS preview uses a native Core Image line-art recipe.
   */
  sketch: [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0,      0,      0,      1, 0,
  ],
};

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

/**
 * Returns the color matrix for the given filter ID.
 * Falls back to the identity matrix if the ID is unknown.
 */
export function getColorMatrix(filterId: string): number[] {
  return COLOR_MATRICES[filterId] ?? IDENTITY_MATRIX;
}

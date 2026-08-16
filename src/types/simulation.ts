export interface EyeParameters {
  id: string;
  speciesName: string;
  rhabdomLength: number;
  rhabdomWidth: number;
  eyeDiameter: number;
  facetWidth: number;
  apertureDiameter: number;
  cytoplasmRefractiveIndex: number;
  rhabdomRefractiveIndex: number;
  blurCircleExtent: number;
  proximalRhabdomAngle: number;
}

export interface CalculatedStats {
  circumferenceOfEye: number;
  apertureRadius: number;
  eyeRadius: number;
  distanceToAperture: number;
  angleAtCenter: number;
  apertureArc: number;
  ommatidialAngle: number;
  numberOfFacets: number;
  rhabdomRadius: number;
  criticalAngle: number;
}

export interface SimulationResult {
  speciesName: string;
  params: EyeParameters;
  calculatedStats: CalculatedStats;
  summaryResCsv: string;
  summarySenCsv: string;
  pathlengthsCsv: string;
  debugCsv?: string;
  /**
   * FWHM of the point spread function in degrees, with rows varying the shielding
   * (proximal screening) pigment and columns the tapetal (reflecting) pigment. A
   * null cell means the profile never falls to half its maximum, so the acceptance
   * angle is undefined rather than merely large.
   */
  matrixRes: (number | null)[][];
  /** Percentage of incident light absorbed (0-100), on the same 11x11 axes. */
  matrixSens: (number | null)[][];
  /** Non-fatal notes from the engine, e.g. annular profiles or discarded rays. */
  warnings?: string[];
  executionTimeMs?: number;
}

export interface ParameterPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  citation?: string;
  parameters: Omit<EyeParameters, 'id'>[];
}

export type InputMode = 'table' | 'csv';
export type ViewTab = 'overview' | 'heatmap-res' | 'heatmap-sen' | 'tradeoff' | 'pathlengths' | 'debug';
export type ColorPalette = 'viridis' | 'turbo' | 'plasma' | 'inferno' | 'oceanic';

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
  matrixRes: number[][];
  matrixSens: number[][];
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

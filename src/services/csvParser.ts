import type { EyeParameters } from '../types/simulation';

export interface ParseResult {
  parameters: EyeParameters[];
  errors: string[];
}

export function parseCsvText(csvText: string): ParseResult {
  const lines = csvText.split(/\r?\n/);
  const parameters: EyeParameters[] = [];
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return; // Skip empty lines and comments
    }

    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 10) {
      // Check if it looks like a header line
      if (index === 0 && (parts[0].toLowerCase() === 'genus' || parts[0].toLowerCase() === 'species')) {
        return; // ignore header
      }
      errors.push(`Line ${index + 1}: Expected 10 comma-separated values, found ${parts.length}`);
      return;
    }

    const speciesName = parts[0].toLowerCase();
    if (speciesName === 'genus' || speciesName === 'species') {
      return; // header row
    }

    const rhabdomLength = parseFloat(parts[1]);
    const rhabdomWidth = parseFloat(parts[2]);
    const eyeDiameter = parseFloat(parts[3]);
    const facetWidth = parseFloat(parts[4]);
    const apertureDiameter = parseFloat(parts[5]);
    const cytoplasmRefractiveIndex = parseFloat(parts[6]);
    const rhabdomRefractiveIndex = parseFloat(parts[7]);
    const blurCircleExtent = parseFloat(parts[8]);
    const proximalRhabdomAngle = parseFloat(parts[9]);

    if (
      isNaN(rhabdomLength) ||
      isNaN(rhabdomWidth) ||
      isNaN(eyeDiameter) ||
      isNaN(facetWidth) ||
      isNaN(apertureDiameter) ||
      isNaN(cytoplasmRefractiveIndex) ||
      isNaN(rhabdomRefractiveIndex) ||
      isNaN(blurCircleExtent) ||
      isNaN(proximalRhabdomAngle)
    ) {
      errors.push(`Line ${index + 1}: Contains non-numeric optical values`);
      return;
    }

    parameters.push({
      id: `param-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      speciesName,
      rhabdomLength,
      rhabdomWidth,
      eyeDiameter,
      facetWidth,
      apertureDiameter,
      cytoplasmRefractiveIndex,
      rhabdomRefractiveIndex,
      blurCircleExtent: Math.max(1, blurCircleExtent),
      proximalRhabdomAngle,
    });
  });

  return { parameters, errors };
}

export function parametersToCsv(params: EyeParameters[]): string {
  return params
    .map((p) =>
      [
        p.speciesName.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        p.rhabdomLength,
        p.rhabdomWidth,
        p.eyeDiameter,
        p.facetWidth,
        p.apertureDiameter,
        p.cytoplasmRefractiveIndex,
        p.rhabdomRefractiveIndex,
        p.blurCircleExtent,
        p.proximalRhabdomAngle,
      ].join(',')
    )
    .join('\n');
}

export function validateParameter(param: Partial<EyeParameters>): string[] {
  const issues: string[] = [];
  if (!param.speciesName || param.speciesName.trim() === '') {
    issues.push('Species / identifier name is required');
  }
  if ((param.rhabdomLength ?? 0) <= 0) {
    issues.push('Rhabdom length must be > 0 µm');
  }
  if ((param.rhabdomWidth ?? 0) <= 0) {
    issues.push('Rhabdom width must be > 0 µm');
  }
  if ((param.eyeDiameter ?? 0) <= 0) {
    issues.push('Eye diameter must be > 0 µm');
  }
  if ((param.facetWidth ?? 0) <= 0) {
    issues.push('Facet width must be > 0 µm');
  }
  if ((param.apertureDiameter ?? 0) <= 0) {
    issues.push('Aperture diameter must be > 0 µm');
  }
  if ((param.apertureDiameter ?? 0) >= (param.eyeDiameter ?? 0)) {
    issues.push('Aperture diameter should be smaller than eye diameter');
  }
  if ((param.cytoplasmRefractiveIndex ?? 0) <= 1.0) {
    issues.push('Cytoplasm refractive index should be > 1.0');
  }
  if ((param.rhabdomRefractiveIndex ?? 0) <= (param.cytoplasmRefractiveIndex ?? 0)) {
    issues.push('Rhabdom refractive index must be greater than cytoplasm refractive index for waveguiding TIR');
  }
  if ((param.blurCircleExtent ?? 0) < 1) {
    issues.push('Blur circle extent must be at least 1');
  }
  return issues;
}

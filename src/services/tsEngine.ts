import type { CalculatedStats, EyeParameters, SimulationResult } from '../types/simulation';

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Number of migration positions sampled for each pigment, from fully retracted (0)
 * to fully covering the rhabdom (rhabdomLength).
 */
export const PIGMENT_STEPS = 11;

/**
 * The largest angle to the rhabdom axis at which a ray can still advance towards the
 * proximal end. At or beyond 90 degrees the ray travels perpendicular to (or back
 * along) the axis and is treated as lost.
 */
const MAX_PROPAGATION_ANGLE = 90.0;

/**
 * The rhabdom absorption coefficient in um^-1, used in the Beer-Lambert absorbance
 * 1 - exp(-k*L). Reported values for crustacean rhabdoms span roughly 0.0067 to
 * 0.01 um^-1.
 */
export const ABSORPTION_COEFFICIENT = 0.01;

/**
 * Labels the columns of the raw geometry output. Every row carries its own keys, so
 * the file is a plain rectangular CSV with no positional state and no block
 * terminator.
 */
export const PATHLENGTHS_HEADER = 'block,shielding_um,tapetal_um,facet,rhabdom,pathlength_um';

/**
 * Rejects inputs that would produce NaNs or nonsensical optics. Without these checks
 * an aperture wider than the eye yields sqrt of a negative number and an empty
 * simulation, while a cytoplasm refractive index at or above the rhabdom's yields a
 * NaN critical angle that silently makes every total-internal-reflection test false.
 */
export function validateParameters(p: EyeParameters): string | null {
  if (!p.speciesName || p.speciesName.trim() === '') {
    return 'species name is required';
  }
  const positives: [string, number][] = [
    ['rhabdom length', p.rhabdomLength],
    ['rhabdom width', p.rhabdomWidth],
    ['eye diameter', p.eyeDiameter],
    ['facet width', p.facetWidth],
    ['aperture diameter', p.apertureDiameter],
  ];
  for (const [name, value] of positives) {
    if (!(value > 0)) {
      return `${name} must be greater than 0 µm, got ${value}`;
    }
  }
  if (p.apertureDiameter >= p.eyeDiameter) {
    return `aperture diameter (${p.apertureDiameter} µm) must be smaller than eye diameter (${p.eyeDiameter} µm)`;
  }
  if (p.cytoplasmRefractiveIndex <= 1.0) {
    return `cytoplasm refractive index must be greater than 1.0, got ${p.cytoplasmRefractiveIndex}`;
  }
  if (p.rhabdomRefractiveIndex <= p.cytoplasmRefractiveIndex) {
    return `rhabdom refractive index (${p.rhabdomRefractiveIndex}) must exceed cytoplasm refractive index (${p.cytoplasmRefractiveIndex}) for total internal reflection`;
  }
  if (p.blurCircleExtent < 1) {
    return `blur circle extent must be at least 1 rhabdom, got ${p.blurCircleExtent}`;
  }
  if (p.proximalRhabdomAngle < 0) {
    return `proximal rhabdom angle must not be negative, got ${p.proximalRhabdomAngle}`;
  }
  return null;
}

/** Applies the empirical corneal refraction regression to an angle of incidence. */
export function refractedAngle(incidence: number): number {
  if (incidence <= 0) return 0.0;
  if (incidence <= 15) return incidence * 0.9494 + 0.004667;
  if (incidence <= 35) return incidence * 0.9407 + 0.1648;
  if (incidence <= 50) return incidence * 0.9196 + 0.8676;
  if (incidence <= 60) return incidence * 0.8677 + 3.38;
  return NaN;
}

/**
 * The area, in squared facet widths, of the annulus of rhabdoms lying at the given
 * whole-rhabdom offset from the optic axis. This is the same measure used to weight
 * the contributing facets, so dividing an area-weighted total by it yields a radial
 * area density.
 */
export function ringArea(offset: number): number {
  if (offset === 0) return Math.PI * 0.25;
  return Math.PI * Math.pow(offset + 0.5, 2) - Math.PI * Math.pow(offset - 0.5, 2);
}

/**
 * Adds an amount at the given offset, growing the profile as required. Earlier
 * versions used a fixed 21-element array and silently discarded everything beyond
 * it, which lost up to a quarter of the absorbed light for widely blurred eyes.
 */
export function deposit(dst: number[], offset: number, amount: number): void {
  if (amount === 0) return;
  while (dst.length <= offset) dst.push(0);
  dst[offset] += amount;
}

/** The derived optics of one eye. */
export class Model {
  readonly params: EyeParameters;
  readonly stats: CalculatedStats;
  readonly ommatidialAngle: number;
  readonly numberOfFacets: number;
  readonly rhabdomRadius: number;
  readonly criticalAngle: number;

  constructor(params: EyeParameters) {
    const invalid = validateParameters(params);
    if (invalid) throw new Error(invalid);

    const circumferenceOfEye = Math.PI * params.eyeDiameter;
    const apertureRadius = params.apertureDiameter / 2.0;
    const eyeRadius = params.eyeDiameter / 2.0;
    const distanceToAperture = Math.sqrt(Math.pow(eyeRadius, 2) - Math.pow(apertureRadius, 2));
    const angleAtCenter = Math.atan(apertureRadius / distanceToAperture) * RAD_TO_DEG;
    const apertureArc = (angleAtCenter / 360.0) * circumferenceOfEye;
    const ommatidialAngle = (params.facetWidth / circumferenceOfEye) * 360.0;
    const rhabdomRadius = params.rhabdomWidth / 2.0;
    const numberOfFacets = Math.round(apertureArc / params.facetWidth);

    // boa is measured from the rhabdom axis, so the angle at the wall normal is
    // (90 - boa) and light is guided while boa < criticalAngle.
    const criticalAngle =
      90.0 - Math.asin(params.cytoplasmRefractiveIndex / params.rhabdomRefractiveIndex) * RAD_TO_DEG;

    if (numberOfFacets < 1) {
      throw new Error(
        `eyeshine patch spans no facets (aperture arc ${apertureArc.toFixed(2)} µm / facet width ${params.facetWidth.toFixed(2)} µm); check aperture and facet dimensions`
      );
    }
    // The blur circle spreads the light gathered across the eyeshine patch over
    // blurCircleExtent rhabdoms. With more blur steps than facets, the mapping from
    // facet to rhabdom offset leaves offsets with no contributing facet at all,
    // producing a comb-shaped profile whose half maximum is a binning artefact.
    if (params.blurCircleExtent > numberOfFacets) {
      throw new Error(
        `blur circle extent (${params.blurCircleExtent} rhabdoms) exceeds the ${numberOfFacets} facets across the eyeshine patch; the resulting profile would contain rhabdom offsets that receive no light`
      );
    }

    this.params = params;
    this.ommatidialAngle = ommatidialAngle;
    this.numberOfFacets = numberOfFacets;
    this.rhabdomRadius = rhabdomRadius;
    this.criticalAngle = criticalAngle;
    this.stats = {
      circumferenceOfEye,
      apertureRadius,
      eyeRadius,
      distanceToAperture,
      angleAtCenter,
      apertureArc,
      ommatidialAngle,
      numberOfFacets,
      rhabdomRadius,
      criticalAngle,
    };
  }

  /**
   * The fraction of light a facet admits at the given angle of incidence, relative
   * to a facet viewed normally. This is a flux factor in [0, 1] and is applied to
   * the absorbed intensity, not to the geometric path length.
   */
  facetTransmission(facetIndex: number): number {
    const incidence = facetIndex * this.ommatidialAngle;
    const refracted = refractedAngle(incidence);
    if (Number.isNaN(refracted)) return 0.0;
    if (refracted === 0) return 1.0;

    const cc = this.params.facetWidth / Math.abs(Math.tan(refracted * DEG_TO_RAD));
    let fw: number;
    if (cc > this.params.facetWidth * 2.0) {
      fw = Math.cos(incidence * DEG_TO_RAD) * this.params.facetWidth;
    } else {
      const ll = 2.0 * cc - 2.0 * this.params.facetWidth;
      fw = Math.sin(incidence * DEG_TO_RAD) * ll;
    }
    return Math.min(1.0, Math.max(0.0, fw / this.params.facetWidth));
  }

  /**
   * The displacement, in rhabdoms, of the image formed by the facet at the given
   * radial position in the eyeshine patch.
   *
   * The blur circle spans blurCircleExtent rhabdoms, so the outermost facet is
   * displaced by (blurCircleExtent - 1) and the central facet by zero. The offset is
   * continuous in the facet index: quantising it to whole rhabdoms (as earlier
   * versions did, via a chain of `facet > fd*i` tests) aliased the facets unevenly
   * across the available offsets and cut notches into the profile at offsets where
   * fd*i landed on an exact integer.
   */
  blurOffset(facetIndex: number): number {
    if (this.numberOfFacets <= 1) return 0.0;
    return (facetIndex * (this.params.blurCircleExtent - 1.0)) / (this.numberOfFacets - 1);
  }

  /**
   * Follows a single ray from the given facet through the rhabdom array for one
   * combination of pigment positions. The returned pathlengths are raw geometry in
   * micrometres, with facet transmission deliberately not folded in.
   */
  traceRay(
    facetIndex: number,
    shielding: number,
    tapetal: number
  ): { pathlengths: number[]; terminalCase: string; maxAngle: number; lost: boolean } {
    const p = this.params;
    const pathlengths: number[] = [];
    let maxAngle = 0;

    // Angle to the rhabdom axis on entry: corneal refraction plus the blur-circle
    // displacement, which tilts the ray by one ommatidial angle per rhabdom offset.
    let boa =
      refractedAngle(facetIndex * this.ommatidialAngle) +
      this.blurOffset(facetIndex) * this.ommatidialAngle;

    let rhabdomLength = p.rhabdomLength;
    let cz = 0;

    for (;;) {
      // Tapered ("pointy") rhabdom tip widens the acceptance angle on first entry.
      if (boa > this.criticalAngle && cz === 0) {
        boa -= p.proximalRhabdomAngle;
        if (boa < 0) boa = 0;
      }

      // A ray at 90 degrees or more to the axis cannot advance towards the proximal
      // end. Earlier versions took the absolute value of tan and cos, which silently
      // folded such rays back and produced path lengths many times the rhabdom length.
      if (boa >= MAX_PROPAGATION_ANGLE || Number.isNaN(boa)) {
        return { pathlengths, terminalCase: 'lost', maxAngle, lost: true };
      }
      if (boa > maxAngle) maxAngle = boa;

      if (facetIndex === 0) {
        // CASE 4: axial ray. Equivalent to case 3 at boa = 0, kept explicit.
        pathlengths.push(tapetal > 0 && shielding === 0 ? rhabdomLength * 2.0 : rhabdomLength);
        return { pathlengths, terminalCase: 'C4', maxAngle, lost: false };
      }

      const sin = Math.sin(boa * DEG_TO_RAD);
      const cos = Math.cos(boa * DEG_TO_RAD);
      const tan = Math.tan(boa * DEG_TO_RAD);

      // Axial distance travelled before the ray meets the rhabdom wall.
      const y = this.rhabdomRadius / tan;

      if (y >= rhabdomLength) {
        // CASE 3: the ray reaches the base without meeting the wall and is reflected
        // by the tapetum at the base.
        const x = rhabdomLength / cos;
        const v = p.rhabdomLength / cos;
        pathlengths.push(tapetal > 0 && shielding === 0 ? x + v : x);
        return { pathlengths, terminalCase: 'C3', maxAngle, lost: false };
      } else if (
        y > rhabdomLength - shielding ||
        y > rhabdomLength - tapetal ||
        boa < this.criticalAngle
      ) {
        // CASE 2: the ray is reflected at the wall, either by total internal
        // reflection or by the tapetal mirror.
        const x = this.rhabdomRadius / sin;

        // A guided ray never leaves the rhabdom, so the proximal screening pigment -
        // which lies in the cytoplasm outside the rhabdom - cannot absorb it. An
        // unguided ray exits through the wall and is absorbed where the pigment starts.
        const guided = boa < this.criticalAngle;
        const axial =
          shielding > 0 && !guided
            ? Math.max(0, rhabdomLength - shielding - y)
            : rhabdomLength - y;
        const z = axial / cos;
        const v = p.rhabdomLength / cos;

        pathlengths.push(tapetal > 0 && shielding === 0 ? x + z + v : x + z);
        return { pathlengths, terminalCase: 'C2', maxAngle, lost: false };
      } else {
        // CASE 1: no reflection. The ray crosses the wall into the adjacent rhabdom,
        // and the inter-rhabdom angle steps by one ommatidial angle.
        pathlengths.push(this.rhabdomRadius / sin);
        rhabdomLength -= y;
        boa += this.ommatidialAngle;
        cz = 1;
        if (rhabdomLength <= tapetal || rhabdomLength <= shielding) {
          return { pathlengths, terminalCase: 'C1', maxAngle, lost: false };
        }
      }
    }
  }
}

/** The resolution and sensitivity derived from one pigment block. */
export interface BlockSummary {
  /**
   * FWHM of the point spread function, in degrees. null when the profile carries no
   * light at all, in which case the acceptance angle is undefined.
   */
  fwhmDegrees: number | null;
  /** Percentage of incident light absorbed, averaged over the eyeshine patch (0-100). */
  sensitivityPercent: number;
  /**
   * The rhabdom offset carrying the most light. A non-zero value means the profile is
   * annular and its FWHM is not a simple acceptance angle.
   */
  peakOffset: number;
}

/**
 * Converts one block's area-weighted absorption profile into resolution and
 * sensitivity.
 */
export function summariseBlock(model: Model, rhabdoms: number[]): BlockSummary {
  const out: BlockSummary = { fwhmDegrees: null, sensitivityPercent: 0, peakOffset: 0 };

  // Sensitivity: the area-weighted mean of the absorbed percentage over the eyeshine
  // patch. The facet weights telescope to exactly pi*(N-0.5)^2, so dividing by that
  // area makes this a true weighted mean in the range 0-100.
  const total = rhabdoms.reduce((a, b) => a + b, 0);
  const patchArea = Math.PI * Math.pow(model.numberOfFacets - 0.5, 2);
  if (patchArea > 0) out.sensitivityPercent = total / patchArea;

  if (rhabdoms.length === 0) return out;

  // Point spread function: light per unit area at each rhabdom offset. The
  // contributing facets are weighted by their source annulus, so the light arriving
  // at an offset must be divided by the annulus it is spread over to recover an
  // intensity. Without this the profile rises monotonically with offset simply
  // because outer annuli contain more ommatidia.
  //
  // The profile ends at the outermost rhabdom that receives any light, so the next
  // offset out is genuinely dark. Including that zero captures the falling edge of
  // the blur circle, which is where a top-hat profile crosses its half maximum.
  const psf = new Array<number>(rhabdoms.length + 1).fill(0);
  for (let j = 0; j < rhabdoms.length; j++) {
    psf[j] = rhabdoms[j] / ringArea(j);
  }

  let peak = 0;
  for (let j = 0; j < psf.length; j++) {
    if (psf[j] > psf[peak]) peak = j;
  }
  out.peakOffset = peak;
  if (psf[peak] <= 0) return out;
  const half = psf[peak] / 2.0;

  // Walk outwards from the peak to the first crossing of the half maximum and
  // interpolate linearly between the bracketing offsets.
  for (let i = peak; i < psf.length - 1; i++) {
    if (psf[i] >= half && psf[i + 1] < half) {
      const frac = (psf[i] - half) / (psf[i] - psf[i + 1]);
      out.fwhmDegrees = 2.0 * (i + frac - peak) * model.ommatidialAngle;
      break;
    }
  }
  return out;
}

/**
 * Runs the ray tracing model and the summary for one eye.
 *
 * @throws if the parameters do not describe a physically realisable eye.
 */
export function runSimulationTS(p: EyeParameters, debugMode = false): SimulationResult {
  const startTime = performance.now();
  const model = new Model(p);

  const incrementAmount = p.rhabdomLength / 10.0;
  const pathlengthLines: string[] = [];
  const debugLines: string[] = [];
  const warnings: string[] = [];
  let lostRays = 0;

  pathlengthLines.push(PATHLENGTHS_HEADER);

  if (debugMode) {
    debugLines.push(
      'block,shielding_um,tapetal_um,facet,incidence_deg,refracted_deg,blur_offset_rhabdoms,entry_boa_deg,facet_transmission,terminal_case,rhabdoms_entered,pathlengths_um'
    );
  }

  const summaries: BlockSummary[] = [];
  let block = 0;

  for (let pStep = 0; pStep < PIGMENT_STEPS; pStep++) {
    const shielding = pStep * incrementAmount;
    for (let tStep = 0; tStep < PIGMENT_STEPS; tStep++) {
      const tapetal = tStep * incrementAmount;

      // Area-weighted absorbed light at each rhabdom offset from the optic axis.
      const rhabdoms: number[] = [];
      const keys = `${block},${shielding.toFixed(6)},${tapetal.toFixed(6)}`;

      for (let facet = 0; facet < model.numberOfFacets; facet++) {
        const trace = model.traceRay(facet, shielding, tapetal);
        if (trace.lost) lostRays++;

        if (trace.pathlengths.length === 0) {
          // A lost ray absorbs nothing, but the facet still belongs in the record,
          // so emit an explicit zero for it.
          pathlengthLines.push(`${keys},${facet},0,0.000000`);
        }
        trace.pathlengths.forEach((v, rhabdom) => {
          pathlengthLines.push(`${keys},${facet},${rhabdom},${v.toFixed(6)}`);
        });

        if (debugMode) {
          const parts = trace.pathlengths.map((v) => v.toFixed(6));
          const incidence = facet * model.ommatidialAngle;
          debugLines.push(
            [
              block,
              shielding.toFixed(4),
              tapetal.toFixed(4),
              facet,
              incidence.toFixed(4),
              refractedAngle(incidence).toFixed(4),
              model.blurOffset(facet).toFixed(4),
              (refractedAngle(incidence) + model.blurOffset(facet) * model.ommatidialAngle).toFixed(4),
              model.facetTransmission(facet).toFixed(6),
              trace.terminalCase,
              trace.pathlengths.length,
              parts.join(' '),
            ].join(',')
          );
        }

        // Light gathered by this facet, and the rhabdom offset its image lands on.
        const transmission = model.facetTransmission(facet);
        const sourceArea = ringArea(facet);
        const offset = model.blurOffset(facet);
        const base = Math.floor(offset);
        const frac = offset - base;

        let tot = 0.0;
        for (let column = 0; column < trace.pathlengths.length; column++) {
          const pathlength = trace.pathlengths[column];
          if (pathlength <= 0) continue;
          // Fraction of the light still travelling that this rhabdom absorbs.
          const absorbed = (1.0 - tot) * (1.0 - Math.exp(-ABSORPTION_COEFFICIENT * pathlength));
          tot += absorbed;
          // Facet transmission attenuates the flux entering the eye; it does not
          // shorten the geometric path, so it multiplies the absorbed intensity
          // rather than the exponent.
          const weighted = 100.0 * transmission * absorbed * sourceArea;

          // The blur displacement is continuous, so split the light between the two
          // rhabdom offsets that bracket it.
          deposit(rhabdoms, base + column, weighted * (1.0 - frac));
          if (frac > 0) deposit(rhabdoms, base + column + 1, weighted * frac);
        }
      }

      summaries.push(summariseBlock(model, rhabdoms));
      block++;
    }
  }

  const matrixRes: (number | null)[][] = [];
  const matrixSens: (number | null)[][] = [];
  const resRows: string[] = [];
  const senRows: string[] = [];
  for (let row = 0; row < PIGMENT_STEPS; row++) {
    const resRow: (number | null)[] = [];
    const senRow: (number | null)[] = [];
    for (let col = 0; col < PIGMENT_STEPS; col++) {
      const s = summaries[row * PIGMENT_STEPS + col];
      resRow.push(s.fwhmDegrees === null ? null : Number(s.fwhmDegrees.toFixed(4)));
      senRow.push(Number(s.sensitivityPercent.toFixed(4)));
    }
    matrixRes.push(resRow);
    matrixSens.push(senRow);
    resRows.push(resRow.map((v) => (v === null ? 'NaN' : v.toFixed(4))).join(','));
    senRows.push(senRow.map((v) => (v as number).toFixed(4)).join(','));
  }

  const undefinedCount = summaries.filter((s) => s.fwhmDegrees === null).length;
  const annularCount = summaries.filter((s) => s.peakOffset !== 0).length;
  if (undefinedCount > 0) {
    warnings.push(
      `${undefinedCount} of ${summaries.length} pigment states have no half-maximum crossing; their resolution is undefined.`
    );
  }
  if (annularCount > 0) {
    warnings.push(
      `${annularCount} of ${summaries.length} pigment states peak away from the optic axis (annular profile); their FWHM is not a simple acceptance angle.`
    );
  }
  if (lostRays > 0) {
    warnings.push(
      `${lostRays} of ${PIGMENT_STEPS * PIGMENT_STEPS * model.numberOfFacets} rays exceeded 90 degrees to the rhabdom axis and were discarded.`
    );
  }

  return {
    speciesName: p.speciesName,
    params: p,
    calculatedStats: model.stats,
    summaryResCsv: resRows.join('\n'),
    summarySenCsv: senRows.join('\n'),
    pathlengthsCsv: pathlengthLines.join('\n'),
    debugCsv: debugLines.join('\n'),
    matrixRes,
    matrixSens,
    warnings,
    executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
  };
}

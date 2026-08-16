import { describe, it, expect } from 'vitest';
import {
  ABSORPTION_COEFFICIENT,
  Model,
  PATHLENGTHS_HEADER,
  PIGMENT_STEPS,
  deposit,
  ringArea,
  runSimulationTS,
  summariseBlock,
} from './tsEngine';
import { PRESETS } from '../constants/presets';
import type { EyeParameters } from '../types/simulation';

/** The reference parameter set: Nephrops norvegicus, flat lateral measurements. */
function nephropsFlatLateral(overrides: Partial<EyeParameters> = {}): EyeParameters {
  return {
    id: 'test_nephrops',
    speciesName: 'test_nephrops',
    rhabdomLength: 180,
    rhabdomWidth: 25,
    eyeDiameter: 7800,
    facetWidth: 50,
    apertureDiameter: 3200,
    cytoplasmRefractiveIndex: 1.34,
    rhabdomRefractiveIndex: 1.37,
    blurCircleExtent: 18,
    proximalRhabdomAngle: 0,
    ...overrides,
  };
}

describe('parameter validation', () => {
  // Each of these previously produced a NaN that silently disabled the
  // total-internal-reflection test or emptied the simulation, with no warning.
  it.each([
    ['cytoplasm index exceeds rhabdom', { cytoplasmRefractiveIndex: 1.4, rhabdomRefractiveIndex: 1.37 }, /total internal reflection/],
    ['equal refractive indices', { rhabdomRefractiveIndex: 1.34 }, /total internal reflection/],
    ['aperture exceeds eye', { apertureDiameter: 9000 }, /aperture diameter/],
    ['zero rhabdom length', { rhabdomLength: 0 }, /rhabdom length/],
    ['blur circle below one', { blurCircleExtent: 0 }, /blur circle extent/],
    // parseFloat yields NaN for unparseable input and accepts "Infinity", and every
    // ordered comparison against NaN is false, so these used to slip past every range
    // check and produce plausible-looking output.
    ['NaN blur circle', { blurCircleExtent: NaN }, /must be a finite number/],
    ['NaN cytoplasm index', { cytoplasmRefractiveIndex: NaN }, /must be a finite number/],
    ['infinite rhabdom length', { rhabdomLength: Infinity }, /must be a finite number/],
    ['infinite proximal angle', { proximalRhabdomAngle: Infinity }, /must be a finite number/],
    ['negative infinite eye diameter', { eyeDiameter: -Infinity }, /must be a finite number/],
  ])('rejects %s', (_name, overrides, pattern) => {
    expect(() => new Model(nephropsFlatLateral(overrides))).toThrow(pattern);
  });

  // astacodes shipped an 18-rhabdom blur circle against only 7 facets, leaving 11
  // rhabdom offsets receiving no light at all.
  it('rejects a blur circle wider than the eyeshine patch', () => {
    expect(() =>
      new Model(
        nephropsFlatLateral({
          rhabdomLength: 84,
          rhabdomWidth: 16,
          eyeDiameter: 890,
          facetWidth: 32,
          apertureDiameter: 445,
          blurCircleExtent: 18,
        })
      )
    ).toThrow(/exceeds the 7 facets/);
  });
});

describe('blur circle mapping', () => {
  // The previous `facet > fd*i` formulation aliased facets unevenly onto whole
  // rhabdom offsets and skipped an offset wherever fd*i landed on an exact integer,
  // cutting a notch that the half-maximum search then locked onto.
  it('spans the extent with a uniform step and no ties', () => {
    const model = new Model(nephropsFlatLateral());
    expect(model.blurOffset(0)).toBe(0);
    expect(model.blurOffset(model.numberOfFacets - 1)).toBeCloseTo(
      model.params.blurCircleExtent - 1,
      9
    );

    const step = model.blurOffset(1) - model.blurOffset(0);
    expect(step).toBeGreaterThan(0);
    for (let facet = 1; facet < model.numberOfFacets; facet++) {
      expect(model.blurOffset(facet) - model.blurOffset(facet - 1)).toBeCloseTo(step, 9);
    }
  });

  it('applies no displacement for a single-rhabdom blur circle', () => {
    const model = new Model(nephropsFlatLateral({ blurCircleExtent: 1 }));
    for (let facet = 0; facet < model.numberOfFacets; facet++) {
      expect(model.blurOffset(facet)).toBe(0);
    }
  });
});

describe('ray tracing geometry', () => {
  // Taking |tan| and |cos| of an angle past 90 degrees used to fold rays back on
  // themselves and yield path lengths many times the rhabdom length.
  it('keeps every ray within its geometric bound', () => {
    for (const proximalRhabdomAngle of [0, 12.5]) {
      const params = nephropsFlatLateral({ proximalRhabdomAngle });
      const model = new Model(params);
      const increment = params.rhabdomLength / 10;

      for (let pStep = 0; pStep < PIGMENT_STEPS; pStep++) {
        for (let tStep = 0; tStep < PIGMENT_STEPS; tStep++) {
          for (let facet = 0; facet < model.numberOfFacets; facet++) {
            const trace = model.traceRay(facet, pStep * increment, tStep * increment);
            expect(trace.lost).toBe(false);
            expect(trace.maxAngle).toBeGreaterThanOrEqual(0);
            expect(trace.maxAngle).toBeLessThan(90);

            // Every segment covers some axial depth at an angle no greater than
            // maxAngle, and the ray traverses the rhabdom at most twice (down, then
            // back off the tapetum).
            const limit =
              (2 * params.rhabdomLength) / Math.cos((trace.maxAngle * Math.PI) / 180) + 1e-9;
            const total = trace.pathlengths.reduce((a, b) => a + b, 0);
            expect(total).toBeLessThanOrEqual(limit);
          }
        }
      }
    }
  });

  // Facet transmission is a flux factor, so it must not be folded into the geometry.
  it('records raw geometry for the axial ray', () => {
    const params = nephropsFlatLateral();
    const model = new Model(params);

    expect(model.traceRay(0, 0, 0).pathlengths).toEqual([params.rhabdomLength]);
    expect(model.traceRay(0, 0, params.rhabdomLength).pathlengths).toEqual([
      2 * params.rhabdomLength,
    ]);
  });

  // The proximal screening pigment lies outside the rhabdom, so it cannot absorb a
  // totally internally reflected ray.
  it('lets a guided ray pass the screening pigment untouched', () => {
    const params = nephropsFlatLateral({ blurCircleExtent: 1 });
    const model = new Model(params);
    const facet = 1;

    const unscreened = model.traceRay(facet, 0, 0);
    const screened = model.traceRay(facet, params.rhabdomLength, 0);
    expect(unscreened.pathlengths[0]).toBeCloseTo(screened.pathlengths[0], 9);
  });
});

describe('summary accumulation', () => {
  // The accumulator used to be a fixed 21-element array that silently discarded
  // everything beyond the twenty-first rhabdom.
  it('grows the profile beyond any fixed size', () => {
    const acc: number[] = [];
    deposit(acc, 40, 3.5);
    expect(acc.length).toBe(41);
    expect(acc[40]).toBe(3.5);
    deposit(acc, 40, 1.5);
    expect(acc[40]).toBe(5);

    const before = acc.length;
    deposit(acc, 99, 0);
    expect(acc.length).toBe(before);
  });

  it('interpolates the half maximum against known profiles', () => {
    const model = new Model(nephropsFlatLateral({ blurCircleExtent: 1 }));
    const omm = model.ommatidialAngle;

    const cases: [string, number[], number][] = [
      // Falls straight to zero: the half maximum lies midway across the first step.
      ['single step', [1, 0], 2 * 0.5 * omm],
      // Sits exactly on the half maximum at offset 1.
      ['exact half at unit offset', [1, 0.5, 0], 2 * 1 * omm],
      ['wider profile', [1, 1, 1, 0], 2 * 2.5 * omm],
      // A top-hat is measured at its own edge: rhabdoms beyond the outermost
      // illuminated one are genuinely dark.
      ['top hat measured at its edge', [1, 1, 1], 2 * 2.5 * omm],
    ];

    for (const [name, psf, want] of cases) {
      const weighted = psf.map((v, j) => v * ringArea(j));
      const got = summariseBlock(model, weighted);
      expect(got.fwhmDegrees, name).toBeCloseTo(want, 9);
      expect(got.peakOffset, name).toBe(0);
    }

    const empty = summariseBlock(model, []);
    expect(empty.fwhmDegrees).toBeNull();
    expect(empty.sensitivityPercent).toBe(0);
  });

  // The angular sensitivity function is even about the optic axis, so its width is
  // measured from the axis. Measuring from the peak understates a flat-topped profile
  // by the peak's own offset: here the light is above half maximum out to radius
  // 2.828, so the full width is 5.657 ommatidial angles, not 3.657.
  it('measures a flat-topped profile from the optic axis, not the peak', () => {
    const model = new Model(nephropsFlatLateral({ blurCircleExtent: 1 }));
    const weighted = [0.99, 1.0, 0.98, 0.4, 0].map((v, j) => v * ringArea(j));
    const got = summariseBlock(model, weighted);

    expect(got.peakOffset).toBe(1);
    expect(got.annular).toBe(false);
    expect(got.fwhmDegrees as number).toBeCloseTo(
      2 * 2.8275862068965516 * model.ommatidialAngle,
      9
    );
  });

  // A profile that dips below half maximum on the axis is a ring. Its supra-half
  // region does not contain the axis, so there is no acceptance angle: reporting the
  // ring's thickness instead would read as an implausibly sharp eye.
  it('reports no acceptance angle for an annular profile', () => {
    const model = new Model(nephropsFlatLateral({ blurCircleExtent: 1 }));
    const weighted = [0.2, 0.6, 1.0, 0.6, 0.2, 0].map((v, j) => v * ringArea(j));
    const got = summariseBlock(model, weighted);

    expect(got.annular).toBe(true);
    expect(got.fwhmDegrees).toBeNull();
    // Sensitivity is independent of the resolution classification.
    expect(got.sensitivityPercent).toBeGreaterThan(0);
  });
});

describe('runSimulationTS', () => {
  it('produces a fully defined 11x11 matrix pair for the reference eye', () => {
    const result = runSimulationTS(nephropsFlatLateral(), false);

    expect(result.calculatedStats.numberOfFacets).toBe(33);
    expect(result.calculatedStats.ommatidialAngle).toBeGreaterThan(0);

    expect(result.matrixRes.length).toBe(PIGMENT_STEPS);
    expect(result.matrixSens.length).toBe(PIGMENT_STEPS);
    for (let row = 0; row < PIGMENT_STEPS; row++) {
      expect(result.matrixRes[row].length).toBe(PIGMENT_STEPS);
      expect(result.matrixSens[row].length).toBe(PIGMENT_STEPS);
      for (let col = 0; col < PIGMENT_STEPS; col++) {
        const res = result.matrixRes[row][col];
        const sens = result.matrixSens[row][col];
        // A null here means the acceptance angle is undefined, which the earlier
        // fabricated fallback hid behind a plausible-looking positive number.
        expect(res, `res[${row}][${col}]`).not.toBeNull();
        expect(res as number).toBeGreaterThan(0);
        expect(sens as number).toBeGreaterThanOrEqual(0);
        expect(sens as number).toBeLessThanOrEqual(100);
      }
    }

    // Migrating the screening pigment across the whole rhabdom must not raise
    // sensitivity; extending the tapetum must not lower it.
    const sens = result.matrixSens as number[][];
    expect(sens[PIGMENT_STEPS - 1][0]).toBeLessThanOrEqual(sens[0][0]);
    expect(sens[0][PIGMENT_STEPS - 1]).toBeGreaterThanOrEqual(sens[0][0]);
  });

  // The geometry output is a plain rectangular CSV: a header, then one row per
  // rhabdom carrying its own keys. Earlier versions relied on positional header lines
  // and a bare `999` terminator, which only avoided colliding with a real 999 um path
  // because of the %.6f formatting.
  it('emits the geometry as a self-describing rectangular CSV', () => {
    const result = runSimulationTS(nephropsFlatLateral(), false);
    const lines = result.pathlengthsCsv.split('\n').filter((l) => l.trim() !== '');

    expect(lines[0]).toBe(PATHLENGTHS_HEADER);
    expect(lines.some((l) => l.trim() === '999')).toBe(false);

    // Every (block, facet) group must appear once, with rhabdom indices from zero.
    const seen = new Map<string, number>();
    for (const line of lines.slice(1)) {
      const fields = line.split(',');
      expect(fields).toHaveLength(6);
      for (const field of fields) {
        expect(Number.isFinite(Number(field))).toBe(true);
      }
      const key = `${fields[0]}:${fields[3]}`;
      const next = seen.get(key) ?? 0;
      expect(Number(fields[4])).toBe(next);
      seen.set(key, next + 1);
    }
    expect(seen.size).toBe(PIGMENT_STEPS * PIGMENT_STEPS * result.calculatedStats.numberOfFacets);
  });

  it('absorbs exactly the Beer-Lambert fraction for a single-facet patch', () => {
    const result = runSimulationTS(
      nephropsFlatLateral({
        speciesName: 'test_single',
        rhabdomLength: 100,
        rhabdomWidth: 20,
        eyeDiameter: 1000,
        facetWidth: 20,
        apertureDiameter: 40,
        blurCircleExtent: 1,
      }),
      false
    );

    expect(result.calculatedStats.numberOfFacets).toBe(1);
    const want = 100 * (1 - Math.exp(-ABSORPTION_COEFFICIENT * 100));
    expect(result.matrixSens[0][0] as number).toBeCloseTo(want, 3);
    // All the light lands on the axial rhabdom and the next offset out is dark.
    expect(result.matrixRes[0][0] as number).toBeCloseTo(
      result.calculatedStats.ommatidialAngle,
      3
    );
  });
});

// astacodes previously shipped placeholder measurements in the preset and an
// unreachable blur circle in the example data. Every bundled preset must describe an
// eye the engine will actually accept.
describe('bundled presets', () => {
  const all = PRESETS.flatMap((preset) =>
    preset.parameters.map((p) => [preset.name, p] as const)
  );

  it.each(all)('%s / %o describes a realisable eye', (_presetName, params) => {
    expect(() => new Model({ id: 'preset', ...params })).not.toThrow();
  });
});

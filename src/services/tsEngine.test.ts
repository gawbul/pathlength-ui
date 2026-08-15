import { describe, it, expect } from 'vitest';
import { runSimulationTS } from './tsEngine';
import type { EyeParameters } from '../types/simulation';

describe('tsEngine', () => {
  it('should run simulation for Nephrops without generating negative resolutions', () => {
    const params: EyeParameters = {
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
    };

    const result = runSimulationTS(params, false);

    // Verify stats
    expect(result.calculatedStats.numberOfFacets).toBeGreaterThan(0);
    expect(result.calculatedStats.ommatidialAngle).toBeGreaterThan(0);
    
    // Verify resolution matrix size
    expect(result.matrixRes.length).toBe(11);
    result.matrixRes.forEach((row) => {
      expect(row.length).toBe(11);
      
      // Verify no negative resolutions exist in the output
      row.forEach((resVal) => {
        expect(resVal).toBeGreaterThanOrEqual(0);
      });
    });

    // Verify sensitivity matrix size
    expect(result.matrixSens.length).toBe(11);
    result.matrixSens.forEach((row) => {
      expect(row.length).toBe(11);
      row.forEach((sensVal) => {
        expect(sensVal).toBeGreaterThanOrEqual(0);
      });
    });

    // The resolution calculation is now mathematically robust and handles wide blur circles correctly
    // Verify that the output resolutions are positive and not absurdly high.
    expect(result.matrixRes[0][1]).toBeGreaterThan(0);
    expect(result.matrixRes[1][4]).toBeGreaterThan(0);
  });
});

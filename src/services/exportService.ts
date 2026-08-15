import JSZip from 'jszip';
import type { EyeParameters, SimulationResult } from '../types/simulation';
import { parametersToCsv } from './csvParser';

export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAllResultsZip(
  results: SimulationResult[],
  paramsList: EyeParameters[],
  zipFilename = 'pathlength_simulation_results.zip'
): Promise<void> {
  const zip = new JSZip();

  // 1. Add parameters input CSV
  const inputCsv = parametersToCsv(paramsList);
  zip.file('input_parameters.csv', inputCsv);

  // 2. Add files for each species
  results.forEach((res) => {
    const prefix = res.speciesName.toLowerCase();
    zip.file(`${prefix}_summary_res.csv`, res.summaryResCsv);
    zip.file(`${prefix}_summary_sen.csv`, res.summarySenCsv);
    zip.file(`${prefix}_pathlengths.csv`, res.pathlengthsCsv);

    if (res.debugCsv) {
      zip.file(`${prefix}_debug.csv`, res.debugCsv);
    }
  });

  // 3. Add full JSON report with optical stats
  const fullReport = {
    generatedAt: new Date().toISOString(),
    engine: 'PathLength Go/WASM Ray-Tracing Model (Gaten, Moss & Johnson, 2013; Moss, 2025)',
    runsCount: results.length,
    simulations: results.map((r) => ({
      speciesName: r.speciesName,
      inputParameters: r.params,
      calculatedOptics: r.calculatedStats,
      executionTimeMs: r.executionTimeMs,
      resolutionMatrix: r.matrixRes,
      sensitivityMatrix: r.matrixSens,
    })),
  };
  zip.file('simulation_report.json', JSON.stringify(fullReport, null, 2));

  // Generate and download zip blob
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', zipFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

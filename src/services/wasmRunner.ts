import type { EyeParameters, SimulationResult } from '../types/simulation';
import { parametersToCsv } from './csvParser';
import { runSimulationTS } from './tsEngine';

declare global {
  interface Window {
    Go?: any;
    runPathlengthSimulation?: (csvContent: string, debugMode: boolean) => string;
    __pathlengthWasmReady?: boolean;
  }
}

let wasmLoadPromise: Promise<boolean> | null = null;
let isWasmAvailable = false;

export async function initWasmEngine(): Promise<boolean> {
  if (isWasmAvailable) return true;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = new Promise(async (resolve) => {
    try {
      if (typeof window === 'undefined' || typeof WebAssembly === 'undefined') {
        resolve(false);
        return;
      }

      const baseUrl = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
      const wasmExecUrl = `${baseUrl}wasm_exec.js`;
      const wasmUrl = `${baseUrl}pathlength.wasm`;

      // Check if wasm_exec.js script is loaded
      if (!window.Go) {
        await new Promise<void>((res, rej) => {
          const script = document.createElement('script');
          script.src = wasmExecUrl;
          script.onload = () => res();
          script.onerror = () => rej(new Error('Failed to load wasm_exec.js'));
          document.head.appendChild(script);
        });
      }

      if (!window.Go) {
        console.warn('window.Go not found after loading wasm_exec.js');
        resolve(false);
        return;
      }

      const go = new window.Go();
      let wasmInstance: WebAssembly.WebAssemblyInstantiatedSource;

      if (WebAssembly.instantiateStreaming) {
        wasmInstance = await WebAssembly.instantiateStreaming(
          fetch(wasmUrl),
          go.importObject
        );
      } else {
        const response = await fetch(wasmUrl);
        const bytes = await response.arrayBuffer();
        wasmInstance = await WebAssembly.instantiate(bytes, go.importObject);
      }

      // Run the Go wasm instance asynchronously
      go.run(wasmInstance.instance);

      // Wait a short moment for global function assignment
      let retries = 20;
      while (retries > 0 && typeof window.runPathlengthSimulation !== 'function') {
        await new Promise((r) => setTimeout(r, 20));
        retries--;
      }

      if (typeof window.runPathlengthSimulation === 'function') {
        isWasmAvailable = true;
        console.log('PathLength WebAssembly engine initialized successfully');
        resolve(true);
      } else {
        console.warn('Wasm loaded but runPathlengthSimulation function not bound');
        resolve(false);
      }
    } catch (err) {
      console.warn('Wasm initialization failed, using TypeScript engine fallback:', err);
      resolve(false);
    }
  });

  return wasmLoadPromise;
}

export async function runSimulations(
  paramsList: EyeParameters[],
  debugMode = false
): Promise<SimulationResult[]> {
  const startTime = performance.now();
  const wasmReady = await initWasmEngine();

  if (wasmReady && typeof window.runPathlengthSimulation === 'function') {
    try {
      const csvContent = parametersToCsv(paramsList);
      const jsonResponse = window.runPathlengthSimulation(csvContent, debugMode);
      const parsed = JSON.parse(jsonResponse);

      if (parsed.success && Array.isArray(parsed.results)) {
        const totalDuration = performance.now() - startTime;
        const durationPerItem = Math.round((totalDuration / parsed.results.length) * 100) / 100;

        if (Array.isArray(parsed.skipped) && parsed.skipped.length > 0) {
          // The engine rejects parameter sets that cannot describe a real eye, so the
          // results array may be shorter than the input list.
          console.warn('Some parameter sets were skipped:', parsed.skipped.join('; '));
        }

        return parsed.results.map((res: any) => ({
          speciesName: res.speciesName,
          // Match on species name rather than position: a rejected row would otherwise
          // shift every subsequent result onto the wrong input parameters.
          params: paramsList.find((p) => p.speciesName === res.speciesName) ?? res.params,
          calculatedStats: res.calculatedStats,
          summaryResCsv: res.summaryResCsv,
          summarySenCsv: res.summarySenCsv,
          pathlengthsCsv: res.pathlengthsCsv,
          debugCsv: res.debugCsv,
          matrixRes: res.matrixRes,
          matrixSens: res.matrixSens,
          warnings: res.warnings,
          executionTimeMs: durationPerItem,
        }));
      } else if (parsed.error) {
        console.warn('Wasm simulation returned error, falling back to TS engine:', parsed.error);
      }
    } catch (wasmErr) {
      console.warn('Error running Wasm simulation, falling back to TS engine:', wasmErr);
    }
  }

  // Fallback to pure TS engine. Parameter sets that cannot describe a real eye are
  // rejected by the engine, so skip them rather than failing the whole batch.
  const results: SimulationResult[] = [];
  for (const p of paramsList) {
    try {
      results.push(runSimulationTS(p, debugMode));
    } catch (err) {
      console.warn(`Skipping ${p.speciesName}:`, err instanceof Error ? err.message : err);
    }
  }
  return results;
}

export function isWasmEngineActive(): boolean {
  return isWasmAvailable && typeof window.runPathlengthSimulation === 'function';
}

import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ParameterGrid } from './components/ParameterGrid';
import { CsvEditor } from './components/CsvEditor';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CitationModal } from './components/CitationModal';
import { TheoryGuideModal } from './components/TheoryGuideModal';
import { PRESETS } from './constants/presets';
import type { EyeParameters, InputMode, ParameterPreset, SimulationResult } from './types/simulation';
import { validateParameter } from './services/csvParser';
import { initWasmEngine, runSimulations } from './services/wasmRunner';
import { Play, Table, FileText, AlertCircle, RefreshCw, Bug } from 'lucide-react';

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pathlength_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const [inputMode, setInputMode] = useState<InputMode>('table');
  const [parameters, setParameters] = useState<EyeParameters[]>(() =>
    PRESETS[0].parameters.map((p, idx) => ({
      ...p,
      id: `param-init-${idx}`,
    }))
  );

  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [results, setResults] = useState<SimulationResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wasmReady, setWasmReady] = useState<boolean>(false);

  const [isCitationOpen, setIsCitationOpen] = useState(false);
  const [isTheoryGuideOpen, setIsTheoryGuideOpen] = useState(false);

  // Initialize Wasm on mount
  useEffect(() => {
    initWasmEngine().then((ready) => {
      setWasmReady(ready);
    });
  }, []);

  // Sync dark mode class with root HTML element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pathlength_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pathlength_theme', 'light');
    }
  }, [darkMode]);

  const handleSelectPreset = (preset: ParameterPreset) => {
    const mapped = preset.parameters.map((p, idx) => ({
      ...p,
      id: `param-${preset.id}-${Date.now()}-${idx}`,
    }));
    setParameters(mapped);
    setErrorMsg(null);
  };

  const handleResetDefaults = () => {
    handleSelectPreset(PRESETS[0]);
  };

  const handleRunSimulations = async () => {
    if (parameters.length === 0) {
      setErrorMsg('Please configure at least one organism parameter set.');
      return;
    }

    // Validate all rows
    for (let i = 0; i < parameters.length; i++) {
      const issues = validateParameter(parameters[i]);
      if (issues.length > 0) {
        setErrorMsg(`Row ${i + 1} (${parameters[i].speciesName || 'Unnamed'}): ${issues.join(', ')}`);
        return;
      }
    }

    setErrorMsg(null);
    setIsRunning(true);

    try {
      // Small timeout to allow UI update
      await new Promise((r) => setTimeout(r, 40));
      const simResults = await runSimulations(parameters, debugMode);
      setResults(simResults);
      // Smooth scroll to results
      setTimeout(() => {
        const resultsEl = document.getElementById('simulation-results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to complete simulations');
    } finally {
      setIsRunning(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunSimulations();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [parameters, debugMode]);

  return (
    <div className="app-layout">
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onSelectPreset={handleSelectPreset}
        onOpenCitation={() => setIsCitationOpen(true)}
        onOpenTheoryGuide={() => setIsTheoryGuideOpen(true)}
        wasmReady={wasmReady}
      />

      <main className="main-content">
        <section className="input-configuration-card">
          <div className="input-header-row">
            <div className="input-mode-tabs">
              <button
                type="button"
                className={`mode-tab ${inputMode === 'table' ? 'active-mode' : ''}`}
                onClick={() => setInputMode('table')}
              >
                <Table size={16} />
                <span>Interactive Parameter Grid</span>
              </button>

              <button
                type="button"
                className={`mode-tab ${inputMode === 'csv' ? 'active-mode' : ''}`}
                onClick={() => setInputMode('csv')}
              >
                <FileText size={16} />
                <span>CSV File Upload & Stream</span>
              </button>
            </div>

            <div className="input-top-actions">
              <label className="debug-toggle-label" title="Generate _debug.csv files containing pigment migration trace logs">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                />
                <Bug size={14} />
                <span>Generate Debug Output (<code>-d</code>)</span>
              </label>

              <button
                type="button"
                className="action-btn run-simulation-btn"
                onClick={handleRunSimulations}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <RefreshCw size={16} className="spinning-icon" />
                    <span>Running Ray Tracer...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    <span>Run Simulation ({parameters.length})</span>
                  </>
                )}
                <span className="run-shortcut-badge">⌘↵</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="error-banner">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="input-body">
            {inputMode === 'table' ? (
              <ParameterGrid
                parameters={parameters}
                onChange={setParameters}
                onResetDefaults={handleResetDefaults}
              />
            ) : (
              <CsvEditor parameters={parameters} onChange={setParameters} />
            )}
          </div>
        </section>

        {/* Results Section */}
        {results && results.length > 0 && (
          <section id="simulation-results-section" className="results-section">
            <ResultsDashboard
              results={results}
              paramsList={parameters}
              onRerun={handleRunSimulations}
            />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-left">
          <span>PathLength v0.6.0 | Reflective Superposition Compound Eye Simulator</span>
          <span className="footer-dot">&bull;</span>
          <span>Go WebAssembly Engine</span>
        </div>
        <div className="footer-right">
          <button type="button" className="footer-link" onClick={() => setIsTheoryGuideOpen(true)}>
            Optics Guide
          </button>
          <span className="footer-dot">&bull;</span>
          <button type="button" className="footer-link" onClick={() => setIsCitationOpen(true)}>
            Citation
          </button>
          <span className="footer-dot">&bull;</span>
          <a
            href="https://github.com/gawbul/pathlength"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub Repository
          </a>
        </div>
      </footer>

      <CitationModal isOpen={isCitationOpen} onClose={() => setIsCitationOpen(false)} />
      <TheoryGuideModal isOpen={isTheoryGuideOpen} onClose={() => setIsTheoryGuideOpen(false)} />
    </div>
  );
}

export default App;

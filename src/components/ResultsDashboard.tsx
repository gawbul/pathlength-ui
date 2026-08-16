import { useState } from 'react';
import type { EyeParameters, SimulationResult, ViewTab } from '../types/simulation';
import { OpticalStatsCard } from './OpticalStatsCard';
import { HeatmapViewer } from './HeatmapViewer';
import { TradeoffPlot } from './TradeoffPlot';
import { PathlengthsTable } from './PathlengthsTable';
import {
  FileArchive,
  Grid,
  TrendingUp,
  Table,
  Terminal,
  Download,
  Flame,
  SunMedium,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { downloadTextFile, exportAllResultsZip } from '../services/exportService';

interface ResultsDashboardProps {
  results: SimulationResult[];
  paramsList: EyeParameters[];
  onRerun?: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  results,
  paramsList,
  onRerun,
}) => {
  const [selectedSpeciesIndex, setSelectedSpeciesIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [isExportingZip, setIsExportingZip] = useState(false);

  const currentResult = results[selectedSpeciesIndex] || results[0];

  if (!currentResult) return null;

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      await exportAllResultsZip(
        results,
        paramsList,
        `pathlength_results_${new Date().toISOString().slice(0, 10)}.zip`
      );
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="results-dashboard-container">
      {/* Top Banner: Species Tabs & Download ZIP Action */}
      <div className="dashboard-header-bar">
        <div className="species-tabs-scroll">
          <div className="species-tabs-list">
            {results.map((res, idx) => {
              const isSelected = idx === selectedSpeciesIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`species-tab-btn ${isSelected ? 'active-tab' : ''}`}
                  onClick={() => setSelectedSpeciesIndex(idx)}
                >
                  <Layers size={14} />
                  <span className="species-tab-name">{res.speciesName}</span>
                  {res.executionTimeMs !== undefined && (
                    <span className="species-tab-time">{res.executionTimeMs}ms</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="dashboard-global-actions">
          {onRerun && (
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={onRerun}
              title="Re-execute simulation with current parameters"
            >
              <RefreshCw size={14} />
              <span>Rerun All</span>
            </button>
          )}

          <button
            type="button"
            className="action-btn zip-download-btn"
            onClick={handleExportZip}
            disabled={isExportingZip}
            title="Download full archive with all CSVs, metadata, and JSON report"
          >
            <FileArchive size={16} />
            <span>{isExportingZip ? 'Compressing Archive...' : 'Download All as ZIP'}</span>
          </button>
        </div>
      </div>

      {/* Sub navigation bar for views */}
      <div className="view-mode-bar">
        <div className="view-tabs">
          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Grid size={15} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'heatmap-res' ? 'active' : ''}`}
            onClick={() => setActiveTab('heatmap-res')}
          >
            <SunMedium size={15} />
            <span>Resolution Matrix (11×11)</span>
          </button>

          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'heatmap-sen' ? 'active' : ''}`}
            onClick={() => setActiveTab('heatmap-sen')}
          >
            <Flame size={15} />
            <span>Sensitivity Matrix (11×11)</span>
          </button>

          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'tradeoff' ? 'active' : ''}`}
            onClick={() => setActiveTab('tradeoff')}
          >
            <TrendingUp size={15} />
            <span>Adaptation Trade-off Curve</span>
          </button>

          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'pathlengths' ? 'active' : ''}`}
            onClick={() => setActiveTab('pathlengths')}
          >
            <Table size={15} />
            <span>Raw Pathlengths CSV</span>
          </button>

          {currentResult.debugCsv && (
            <button
              type="button"
              className={`view-tab-btn ${activeTab === 'debug' ? 'active' : ''}`}
              onClick={() => setActiveTab('debug')}
            >
              <Terminal size={15} />
              <span>Debug Log</span>
            </button>
          )}
        </div>

        {/* Quick individual file download for current species */}
        <div className="species-download-group">
          <button
            type="button"
            className="action-btn secondary-btn small-btn"
            onClick={() =>
              downloadTextFile(
                `${currentResult.speciesName}_summary_res.csv`,
                currentResult.summaryResCsv
              )
            }
            title="Download Resolution CSV"
          >
            <Download size={13} />
            <span>Res CSV</span>
          </button>

          <button
            type="button"
            className="action-btn secondary-btn small-btn"
            onClick={() =>
              downloadTextFile(
                `${currentResult.speciesName}_summary_sen.csv`,
                currentResult.summarySenCsv
              )
            }
            title="Download Sensitivity CSV"
          >
            <Download size={13} />
            <span>Sen CSV</span>
          </button>

          <button
            type="button"
            className="action-btn secondary-btn small-btn"
            onClick={() =>
              downloadTextFile(
                `${currentResult.speciesName}_pathlengths.csv`,
                currentResult.pathlengthsCsv
              )
            }
            title="Download Pathlengths CSV"
          >
            <Download size={13} />
            <span>Pathlengths CSV</span>
          </button>
        </div>
      </div>

      {/* Tab Content Display */}
      <div className="dashboard-content-area">
        {activeTab === 'overview' && (
          <div className="overview-view">
            <OpticalStatsCard
              stats={currentResult.calculatedStats}
              params={currentResult.params}
            />

            <div className="overview-split-matrices">
              <div className="overview-matrix-preview">
                <div className="preview-header">
                  <SunMedium size={16} />
                  <h4>Acceptance Angle Matrix (FWHM, degrees)</h4>
                </div>
                <HeatmapViewer
                  matrix={currentResult.matrixRes}
                  matrixType="resolution"
                  params={currentResult.params}
                  onDownloadCsv={() =>
                    downloadTextFile(
                      `${currentResult.speciesName}_summary_res.csv`,
                      currentResult.summaryResCsv
                    )
                  }
                />
              </div>

              <div className="overview-matrix-preview">
                <div className="preview-header">
                  <Flame size={16} />
                  <h4>Sensitivity Matrix (light absorbed, %)</h4>
                </div>
                <HeatmapViewer
                  matrix={currentResult.matrixSens}
                  matrixType="sensitivity"
                  params={currentResult.params}
                  onDownloadCsv={() =>
                    downloadTextFile(
                      `${currentResult.speciesName}_summary_sen.csv`,
                      currentResult.summarySenCsv
                    )
                  }
                />
              </div>
            </div>

            <TradeoffPlot
              matrixRes={currentResult.matrixRes}
              matrixSens={currentResult.matrixSens}
              params={currentResult.params}
            />
          </div>
        )}

        {activeTab === 'heatmap-res' && (
          <div className="single-view-pane">
            <div className="pane-header">
              <h3>Acceptance Angle Matrix &mdash; FWHM of the point spread function (degrees)</h3>
              <p>Larger angles mean a wider acceptance angle and so lower spatial acuity. A cell reading <code>n/a</code> is a pigment state whose profile never falls to half its maximum, leaving the acceptance angle undefined.</p>
            </div>
            <HeatmapViewer
              matrix={currentResult.matrixRes}
              matrixType="resolution"
              params={currentResult.params}
              onDownloadCsv={() =>
                downloadTextFile(
                  `${currentResult.speciesName}_summary_res.csv`,
                  currentResult.summaryResCsv
                )
              }
            />
          </div>
        )}

        {activeTab === 'heatmap-sen' && (
          <div className="single-view-pane">
            <div className="pane-header">
              <h3>Sensitivity Matrix &mdash; incident light absorbed (%)</h3>
              <p>The percentage of incident light absorbed by the rhabdom array, area-weighted across the eyeshine patch.</p>
            </div>
            <HeatmapViewer
              matrix={currentResult.matrixSens}
              matrixType="sensitivity"
              params={currentResult.params}
              onDownloadCsv={() =>
                downloadTextFile(
                  `${currentResult.speciesName}_summary_sen.csv`,
                  currentResult.summarySenCsv
                )
              }
            />
          </div>
        )}

        {activeTab === 'tradeoff' && (
          <div className="single-view-pane">
            <TradeoffPlot
              matrixRes={currentResult.matrixRes}
              matrixSens={currentResult.matrixSens}
              params={currentResult.params}
            />
          </div>
        )}

        {activeTab === 'pathlengths' && (
          <div className="single-view-pane">
            <PathlengthsTable
              speciesName={currentResult.speciesName}
              pathlengthsCsv={currentResult.pathlengthsCsv}
            />
          </div>
        )}

        {activeTab === 'debug' && currentResult.debugCsv && (
          <div className="single-view-pane">
            <div className="debug-log-header">
              <h3>Simulation Execution & Debug Trace Log</h3>
              <button
                type="button"
                className="action-btn secondary-btn small-btn"
                onClick={() =>
                  downloadTextFile(
                    `${currentResult.speciesName}_debug.csv`,
                    currentResult.debugCsv!
                  )
                }
              >
                <Download size={13} />
                <span>Download Debug CSV</span>
              </button>
            </div>
            <pre className="debug-log-viewer">
              <code>{currentResult.debugCsv}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

import { useState } from 'react';
import type { ColorPalette, EyeParameters } from '../types/simulation';
import { Palette, Copy, Download, Check, Info } from 'lucide-react';

interface HeatmapViewerProps {
  matrix: number[][];
  matrixType: 'resolution' | 'sensitivity';
  params: EyeParameters;
  onDownloadCsv: () => void;
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({
  matrix,
  matrixType,
  params,
  onDownloadCsv,
}) => {
  const [palette, setPalette] = useState<ColorPalette>('viridis');
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    value: number;
    pVal: number;
    tVal: number;
  } | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const incrementAmount = params.rhabdomLength / 10.0;

  // Compute min and max
  let minVal = Infinity;
  let maxVal = -Infinity;
  let sum = 0;
  let count = 0;

  matrix.forEach((row) => {
    row.forEach((val) => {
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
      sum += val;
      count++;
    });
  });

  const avgVal = count > 0 ? sum / count : 0;
  const valRange = maxVal - minVal || 1;

  // Color interpolation helpers
  const getColor = (val: number): string => {
    const t = Math.max(0, Math.min(1, (val - minVal) / valRange));
    switch (palette) {
      case 'viridis':
        return getViridisColor(t);
      case 'plasma':
        return getPlasmaColor(t);
      case 'inferno':
        return getInfernoColor(t);
      case 'oceanic':
        return getOceanicColor(t);
      case 'turbo':
      default:
        return getTurboColor(t);
    }
  };

  // Viridis approximation
  const getViridisColor = (t: number): string => {
    // 0.0 -> dark blue/purple, 0.5 -> teal/green, 1.0 -> yellow
    const r = Math.round(255 * Math.sin(t * Math.PI * 0.9 + 0.2) * (t > 0.5 ? 1 : 0.4 + t * 0.6));
    const g = Math.round(255 * (0.05 + 0.9 * t));
    const b = Math.round(255 * (0.4 + 0.5 * (1 - t) * (t < 0.8 ? 1 : 0.2)));
    return `rgb(${Math.min(255, Math.max(20, r))}, ${Math.min(255, Math.max(10, g))}, ${Math.min(255, Math.max(40, b))})`;
  };

  const getPlasmaColor = (t: number): string => {
    const r = Math.round(255 * Math.min(1, 0.05 + 1.2 * t));
    const g = Math.round(255 * Math.max(0, Math.sin(t * Math.PI) * 0.9));
    const b = Math.round(255 * Math.max(0, 0.8 * (1 - t * 0.9)));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getInfernoColor = (t: number): string => {
    const r = Math.round(255 * Math.min(1, t * 1.3));
    const g = Math.round(255 * Math.max(0, Math.pow(t, 2) * 1.1));
    const b = Math.round(255 * (t < 0.3 ? t * 255 : 0.1));
    return `rgb(${r}, ${g}, ${Math.min(255, b)})`;
  };

  const getOceanicColor = (t: number): string => {
    const r = Math.round(20 + 40 * t);
    const g = Math.round(50 + 170 * t);
    const b = Math.round(90 + 165 * Math.sin(t * Math.PI * 0.5));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getTurboColor = (t: number): string => {
    const r = Math.round(255 * Math.min(1, Math.max(0, 1.5 * t - 0.2)));
    const g = Math.round(255 * Math.sin(t * Math.PI));
    const b = Math.round(255 * Math.min(1, Math.max(0, 1.5 * (1 - t) - 0.2)));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const copyAsTable = (delimiter: string, formatName: string) => {
    const text = matrix.map((row) => row.join(delimiter)).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  return (
    <div className="heatmap-container">
      <div className="heatmap-toolbar">
        <div className="heatmap-info-stats">
          <div className="stat-pill">
            <span>Range:</span> <strong>{minVal} – {maxVal}</strong>
          </div>
          <div className="stat-pill">
            <span>Average:</span> <strong>{avgVal.toFixed(1)}</strong>
          </div>
          <div className="stat-pill">
            <span>Matrix:</span> <strong>11×11 (121 states)</strong>
          </div>
        </div>

        <div className="heatmap-controls">
          <div className="palette-select-group">
            <Palette size={14} />
            <label htmlFor="palette-select" className="sr-only">Color Palette</label>
            <select
              id="palette-select"
              className="palette-select"
              value={palette}
              onChange={(e) => setPalette(e.target.value as ColorPalette)}
            >
              <option value="viridis">Viridis Palette</option>
              <option value="turbo">Turbo Palette</option>
              <option value="plasma">Plasma Palette</option>
              <option value="inferno">Inferno Palette</option>
              <option value="oceanic">Oceanic Blue</option>
            </select>
          </div>

          <button
            type="button"
            className="action-btn secondary-btn small-btn"
            onClick={() => copyAsTable(',', 'CSV')}
            title="Copy comma-separated matrix to clipboard"
          >
            {copiedFormat === 'CSV' ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedFormat === 'CSV' ? 'Copied' : 'Copy CSV'}</span>
          </button>

          <button
            type="button"
            className="action-btn secondary-btn small-btn"
            onClick={() => copyAsTable('\t', 'TSV')}
            title="Copy tab-separated matrix for Excel / Sheets"
          >
            {copiedFormat === 'TSV' ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedFormat === 'TSV' ? 'Copied' : 'Copy TSV'}</span>
          </button>

          <button
            type="button"
            className="action-btn primary-btn small-btn"
            onClick={onDownloadCsv}
            title="Download CSV file"
          >
            <Download size={13} />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      <div className="heatmap-layout">
        <div className="heatmap-matrix-wrapper">
          {/* Top X-Axis Label */}
          <div className="heatmap-x-header">
            <span className="axis-title">Tapetal Pigment Length &rarr; (0% Retracted to 100% Extended)</span>
          </div>

          <div className="heatmap-grid-and-y-axis">
            {/* Left Y-Axis Label */}
            <div className="heatmap-y-label-vertical">
              <span>Shielding Pigment Length &darr; (0% Retracted to 100% Extended)</span>
            </div>

            <div className="heatmap-table-container">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th className="heatmap-corner-cell">P \ T</th>
                    {Array.from({ length: 11 }).map((_, colIdx) => (
                      <th key={colIdx} className="heatmap-col-header">
                        <div className="header-step">T{colIdx}</div>
                        <div className="header-um">{(colIdx * incrementAmount).toFixed(0)}µm</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, rowIdx) => {
                    const pLength = (rowIdx * incrementAmount).toFixed(0);
                    return (
                      <tr key={rowIdx}>
                        <th className="heatmap-row-header">
                          <div className="header-step">P{rowIdx}</div>
                          <div className="header-um">{pLength}µm</div>
                        </th>
                        {row.map((val, colIdx) => {
                          const tLength = (colIdx * incrementAmount).toFixed(0);
                          const isHovered =
                            hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                          const bg = getColor(val);
                          const relativeNorm = (val - minVal) / valRange;
                          const textColor = relativeNorm > 0.65 ? '#000000' : '#ffffff';

                          return (
                            <td
                              key={colIdx}
                              className={`heatmap-cell ${isHovered ? 'cell-hovered' : ''}`}
                              style={{ backgroundColor: bg, color: textColor }}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  row: rowIdx,
                                  col: colIdx,
                                  value: val,
                                  pVal: parseFloat(pLength),
                                  tVal: parseFloat(tLength),
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              <span className="cell-number">{val}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Dynamic Detail & Legend Box */}
        <div className="heatmap-sidebar">
          <div className="color-legend-card">
            <h4>Scientific Value Scale</h4>
            <div className="legend-gradient-bar" style={{
              background: `linear-gradient(to right, ${getColor(minVal)}, ${getColor(minVal + valRange * 0.5)}, ${getColor(maxVal)})`
            }} />
            <div className="legend-labels">
              <span>{minVal} (Min)</span>
              <span>{avgVal.toFixed(0)} (Mean)</span>
              <span>{maxVal} (Max)</span>
            </div>
          </div>

          <div className="cell-inspector-card">
            <h4>Cell Dynamic Inspector</h4>
            {hoveredCell ? (
              <div className="inspector-details">
                <div className="inspector-value-box">
                  <span className="inspector-val">{hoveredCell.value}</span>
                  <span className="inspector-sub">
                    {matrixType === 'resolution' ? 'Optical Acceptance Index' : 'Sensitivity Flux'}
                  </span>
                </div>
                <div className="inspector-metrics">
                  <div className="metric-row">
                    <span>Shielding Pigment (P):</span>
                    <strong>
                      {hoveredCell.pVal} µm <span className="step-tag">(Step {hoveredCell.row}/10)</span>
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span>Tapetal Pigment (T):</span>
                    <strong>
                      {hoveredCell.tVal} µm <span className="step-tag">(Step {hoveredCell.col}/10)</span>
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span>Relative to Peak:</span>
                    <strong>{(((hoveredCell.value - minVal) / valRange) * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="inspector-placeholder">
                <Info size={18} />
                <p>Hover over any cell in the 11×11 grid to inspect pigment coordinates and values.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState } from 'react';
import type { EyeParameters } from '../types/simulation';
import { TrendingUp, Info } from 'lucide-react';

interface TradeoffPlotProps {
  matrixRes: number[][];
  matrixSens: number[][];
  params: EyeParameters;
}

interface PlotPoint {
  pStep: number;
  tStep: number;
  pLength: number;
  tLength: number;
  res: number;
  sens: number;
}

export const TradeoffPlot: React.FC<TradeoffPlotProps> = ({
  matrixRes,
  matrixSens,
  params,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<PlotPoint | null>(null);

  const incrementAmount = params.rhabdomLength / 10.0;
  const points: PlotPoint[] = [];

  let minRes = Infinity, maxRes = -Infinity;
  let minSens = Infinity, maxSens = -Infinity;

  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const res = matrixRes[r]?.[c] ?? 0;
      const sens = matrixSens[r]?.[c] ?? 0;
      if (res < minRes) minRes = res;
      if (res > maxRes) maxRes = res;
      if (sens < minSens) minSens = sens;
      if (sens > maxSens) maxSens = sens;

      points.push({
        pStep: r,
        tStep: c,
        pLength: Math.round(r * incrementAmount * 10) / 10,
        tLength: Math.round(c * incrementAmount * 10) / 10,
        res,
        sens,
      });
    }
  }

  // Plot dimensions
  const svgWidth = 640;
  const svgHeight = 360;
  const padding = { top: 30, right: 40, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const resRange = maxRes - minRes || 1;
  const sensRange = maxSens - minSens || 1;

  const getX = (res: number) => padding.left + ((res - minRes) / resRange) * plotWidth;
  const getY = (sens: number) => padding.top + plotHeight - ((sens - minSens) / sensRange) * plotHeight;

  return (
    <div className="tradeoff-container">
      <div className="tradeoff-header">
        <div className="tradeoff-title-group">
          <TrendingUp size={18} />
          <h3>Resolution vs Sensitivity Adaptation Frontier</h3>
        </div>
        <p className="tradeoff-subtitle">
          Mapping all 121 pigment states to visualize the optical trade-off between sensitivity (light gathering)
          and resolution (spatial visual acuity).
        </p>
      </div>

      <div className="tradeoff-content-row">
        <div className="svg-plot-container">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="tradeoff-svg"
            role="img"
            aria-label="Resolution vs Sensitivity Scatter Plot"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padding.top + plotHeight * (1 - pct);
              const x = padding.left + plotWidth * pct;
              const sensVal = Math.round(minSens + sensRange * pct);
              const resVal = Math.round(minRes + resRange * pct);

              return (
                <g key={i} className="grid-group">
                  {/* Horizontal grid */}
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotWidth}
                    y2={y}
                    stroke="var(--border-subtle)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="axis-label"
                  >
                    {sensVal}
                  </text>

                  {/* Vertical grid */}
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + plotHeight}
                    stroke="var(--border-subtle)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={x}
                    y={padding.top + plotHeight + 20}
                    textAnchor="middle"
                    className="axis-label"
                  >
                    {resVal}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={padding.left}
              y1={padding.top + plotHeight}
              x2={padding.left + plotWidth}
              y2={padding.top + plotHeight}
              stroke="var(--text-secondary)"
              strokeWidth="1.5"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + plotHeight}
              stroke="var(--text-secondary)"
              strokeWidth="1.5"
            />

            {/* Axis Titles */}
            <text
              x={padding.left + plotWidth / 2}
              y={svgHeight - 10}
              textAnchor="middle"
              className="axis-title-svg"
            >
              Calculated Resolution (200 &times; Optical Acceptance Angle) &rarr;
            </text>
            <text
              x={-padding.top - plotHeight / 2}
              y={18}
              transform="rotate(-90)"
              textAnchor="middle"
              className="axis-title-svg"
            >
              Sensitivity (Integrated Catch / Area) &rarr;
            </text>

            {/* Plot Points */}
            {points.map((pt, idx) => {
              const cx = getX(pt.res);
              const cy = getY(pt.sens);
              const isDarkAdapted = pt.pStep === 0 && pt.tStep === 10;
              const isLightAdapted = pt.pStep === 10 && pt.tStep === 0;
              const isHovered =
                hoveredPoint?.pStep === pt.pStep && hoveredPoint?.tStep === pt.tStep;

              // Color point based on shielding pigment step
              const hue = Math.round(210 - pt.pStep * 15); // blue to orange
              const fillColor = `hsl(${hue}, 85%, 55%)`;

              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 7 : isDarkAdapted || isLightAdapted ? 6 : 4}
                  fill={isDarkAdapted ? '#10b981' : isLightAdapted ? '#f59e0b' : fillColor}
                  stroke={isHovered ? '#ffffff' : 'rgba(0,0,0,0.3)'}
                  strokeWidth={isHovered ? 2 : 1}
                  className="plot-circle"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}
          </svg>
        </div>

        <div className="tradeoff-info-card">
          <h4>State Inspection</h4>
          {hoveredPoint ? (
            <div className="point-card">
              <div className="point-metrics">
                <div className="metric-row">
                  <span>Resolution:</span>
                  <strong>{hoveredPoint.res}</strong>
                </div>
                <div className="metric-row">
                  <span>Sensitivity:</span>
                  <strong>{hoveredPoint.sens}</strong>
                </div>
                <div className="metric-row">
                  <span>Shielding Pigment (P):</span>
                  <strong>{hoveredPoint.pLength} µm (Step {hoveredPoint.pStep}/10)</strong>
                </div>
                <div className="metric-row">
                  <span>Tapetal Pigment (T):</span>
                  <strong>{hoveredPoint.tLength} µm (Step {hoveredPoint.tStep}/10)</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="point-placeholder">
              <Info size={16} />
              <p>Hover over points on the scatter plot to view individual optical states.</p>
            </div>
          )}

          <div className="adaptation-legend">
            <h5>Key Biological States</h5>
            <div className="legend-item">
              <span className="dot dot-dark" />
              <span>
                <strong>Dark-Adapted (Green):</strong> Retracted shielding (P0) + Full tapetal mirror (T10). Peak sensitivity.
              </span>
            </div>
            <div className="legend-item">
              <span className="dot dot-light" />
              <span>
                <strong>Light-Adapted (Amber):</strong> Full shielding (P10) + Retracted tapetum (T0). Peak acuity.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

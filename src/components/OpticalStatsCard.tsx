import type { CalculatedStats, EyeParameters } from '../types/simulation';
import { Activity, CircleDot, Eye, Compass, ShieldCheck } from 'lucide-react';

interface OpticalStatsCardProps {
  stats: CalculatedStats;
  params: EyeParameters;
}

export const OpticalStatsCard: React.FC<OpticalStatsCardProps> = ({ stats, params }) => {
  return (
    <div className="optical-stats-container">
      <div className="stats-header">
        <Activity size={18} className="stats-header-icon" />
        <h3>Derived Optical Geometry & Waveguide Constants</h3>
        <span className="stats-species-badge">{params.speciesName}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            <Eye size={14} /> Eye Radius (R<sub>eye</sub>)
          </div>
          <div className="stat-value">{stats.eyeRadius.toFixed(1)} <span className="stat-unit">µm</span></div>
          <div className="stat-sub">Circumference: {stats.circumferenceOfEye.toFixed(1)} µm</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <CircleDot size={14} /> Aperture Radius (R<sub>ap</sub>)
          </div>
          <div className="stat-value">{stats.apertureRadius.toFixed(1)} <span className="stat-unit">µm</span></div>
          <div className="stat-sub">Distance to Aperture: {stats.distanceToAperture.toFixed(1)} µm</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Compass size={14} /> Ommatidial Angle (&Delta;&phi;)
          </div>
          <div className="stat-value">{stats.ommatidialAngle.toFixed(3)}<span className="stat-unit">°</span></div>
          <div className="stat-sub">Aperture Arc: {stats.apertureArc.toFixed(1)} µm</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <ShieldCheck size={14} /> Facets in Eyeshine Axis (N)
          </div>
          <div className="stat-value">{stats.numberOfFacets} <span className="stat-unit">facets</span></div>
          <div className="stat-sub">Subtended Angle: {stats.angleAtCenter.toFixed(2)}°</div>
        </div>

        <div className="stat-card highlight-stat">
          <div className="stat-label">Critical TIR Angle (&theta;<sub>c</sub>)</div>
          <div className="stat-value">{stats.criticalAngle.toFixed(2)}<span className="stat-unit">°</span></div>
          <div className="stat-sub">
            n<sub>cyto</sub> = {params.cytoplasmRefractiveIndex} / n<sub>rhab</sub> = {params.rhabdomRefractiveIndex}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Rhabdom Waveguide Radius</div>
          <div className="stat-value">{stats.rhabdomRadius.toFixed(1)} <span className="stat-unit">µm</span></div>
          <div className="stat-sub">
            Aspect Ratio: {(params.rhabdomLength / params.rhabdomWidth).toFixed(1)}:1
          </div>
        </div>
      </div>
    </div>
  );
};

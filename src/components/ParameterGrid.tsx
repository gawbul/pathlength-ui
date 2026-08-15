import React from 'react';
import { Plus, Copy, Trash2, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { EyeParameters } from '../types/simulation';
import { validateParameter } from '../services/csvParser';

interface ParameterGridProps {
  parameters: EyeParameters[];
  onChange: (parameters: EyeParameters[]) => void;
  onResetDefaults: () => void;
}

export const ParameterGrid: React.FC<ParameterGridProps> = ({
  parameters,
  onChange,
  onResetDefaults,
}) => {
  const handleFieldChange = (
    id: string,
    field: keyof EyeParameters,
    value: string | number
  ) => {
    const updated = parameters.map((p) => {
      if (p.id !== id) return p;
      if (field === 'speciesName') {
        return { ...p, speciesName: (value as string).toLowerCase().replace(/[^a-z0-9_]/g, '') };
      }
      const numVal = parseFloat(value as string);
      return { ...p, [field]: isNaN(numVal) ? 0 : numVal };
    });
    onChange(updated);
  };

  const handleAddRow = () => {
    const newParam: EyeParameters = {
      id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      speciesName: `species_${parameters.length + 1}`,
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
    onChange([...parameters, newParam]);
  };

  const handleDuplicateRow = (index: number) => {
    const target = parameters[index];
    const newParam: EyeParameters = {
      ...target,
      id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      speciesName: `${target.speciesName}_copy`,
    };
    const updated = [...parameters];
    updated.splice(index + 1, 0, newParam);
    onChange(updated);
  };

  const handleDeleteRow = (index: number) => {
    if (parameters.length <= 1) {
      alert('At least one parameter set is required.');
      return;
    }
    const updated = parameters.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="parameter-grid-container">
      <div className="grid-toolbar">
        <div className="grid-summary">
          <span className="summary-pill">
            <strong>{parameters.length}</strong> {parameters.length === 1 ? 'simulation run' : 'simulation runs'} configured
          </span>
        </div>

        <div className="grid-actions">
          <button type="button" className="action-btn secondary-btn" onClick={handleAddRow}>
            <Plus size={15} />
            <span>Add Organism Row</span>
          </button>
          <button
            type="button"
            className="action-btn ghost-btn"
            onClick={onResetDefaults}
            title="Reset to default Nephrops norvegicus dataset"
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      <div className="table-responsive-wrapper">
        <table className="param-table">
          <thead>
            <tr>
              <th className="th-index">#</th>
              <th className="th-species">
                Species / Identifier
                <span className="th-hint">Alphanumeric</span>
              </th>
              <th>
                Rhabdom L
                <span className="th-unit">(µm)</span>
              </th>
              <th>
                Rhabdom W
                <span className="th-unit">(µm)</span>
              </th>
              <th>
                Eye Diam
                <span className="th-unit">(µm)</span>
              </th>
              <th>
                Facet W
                <span className="th-unit">(µm)</span>
              </th>
              <th>
                Aperture D
                <span className="th-unit">(µm)</span>
              </th>
              <th>
                Cyto RI
                <span className="th-unit">(n<sub>cyto</sub>)</span>
              </th>
              <th>
                Rhab RI
                <span className="th-unit">(n<sub>rhab</sub>)</span>
              </th>
              <th>
                Blur Ext
                <span className="th-unit">(Count)</span>
              </th>
              <th>
                Prox Angle
                <span className="th-unit">(deg °)</span>
              </th>
              <th className="th-status">Status</th>
              <th className="th-row-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((p, idx) => {
              const validationErrors = validateParameter(p);
              const isValid = validationErrors.length === 0;

              return (
                <tr key={p.id} className={!isValid ? 'row-invalid' : ''}>
                  <td className="td-index">{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="table-input input-species"
                      value={p.speciesName}
                      onChange={(e) => handleFieldChange(p.id, 'speciesName', e.target.value)}
                      placeholder="e.g. nephropsfl"
                      aria-label="Species Name"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="table-input"
                      value={p.rhabdomLength}
                      onChange={(e) => handleFieldChange(p.id, 'rhabdomLength', e.target.value)}
                      aria-label="Rhabdom Length"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      className="table-input"
                      value={p.rhabdomWidth}
                      onChange={(e) => handleFieldChange(p.id, 'rhabdomWidth', e.target.value)}
                      aria-label="Rhabdom Width"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="table-input"
                      value={p.eyeDiameter}
                      onChange={(e) => handleFieldChange(p.id, 'eyeDiameter', e.target.value)}
                      aria-label="Eye Diameter"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      className="table-input"
                      value={p.facetWidth}
                      onChange={(e) => handleFieldChange(p.id, 'facetWidth', e.target.value)}
                      aria-label="Facet Width"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="table-input"
                      value={p.apertureDiameter}
                      onChange={(e) => handleFieldChange(p.id, 'apertureDiameter', e.target.value)}
                      aria-label="Aperture Diameter"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="1.0"
                      max="2.0"
                      className="table-input"
                      value={p.cytoplasmRefractiveIndex}
                      onChange={(e) =>
                        handleFieldChange(p.id, 'cytoplasmRefractiveIndex', e.target.value)
                      }
                      aria-label="Cytoplasm Refractive Index"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="1.0"
                      max="2.0"
                      className="table-input"
                      value={p.rhabdomRefractiveIndex}
                      onChange={(e) =>
                        handleFieldChange(p.id, 'rhabdomRefractiveIndex', e.target.value)
                      }
                      aria-label="Rhabdom Refractive Index"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="table-input"
                      value={p.blurCircleExtent}
                      onChange={(e) => handleFieldChange(p.id, 'blurCircleExtent', e.target.value)}
                      aria-label="Blur Circle Extent"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="90"
                      className="table-input"
                      value={p.proximalRhabdomAngle}
                      onChange={(e) =>
                        handleFieldChange(p.id, 'proximalRhabdomAngle', e.target.value)
                      }
                      aria-label="Proximal Rhabdom Angle"
                    />
                  </td>
                  <td className="td-status">
                    {isValid ? (
                      <span className="status-valid" title="All optical parameters valid">
                        <CheckCircle2 size={16} />
                      </span>
                    ) : (
                      <span
                        className="status-invalid"
                        title={validationErrors.join('\n')}
                      >
                        <AlertTriangle size={16} />
                      </span>
                    )}
                  </td>
                  <td className="td-actions">
                    <button
                      type="button"
                      className="row-btn"
                      onClick={() => handleDuplicateRow(idx)}
                      title="Duplicate row"
                      aria-label="Duplicate row"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className="row-btn delete-btn"
                      onClick={() => handleDeleteRow(idx)}
                      title="Delete row"
                      disabled={parameters.length <= 1}
                      aria-label="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

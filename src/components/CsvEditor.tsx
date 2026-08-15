import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Download, AlertCircle, Check } from 'lucide-react';
import type { EyeParameters } from '../types/simulation';
import { parseCsvText, parametersToCsv } from '../services/csvParser';
import { downloadTextFile } from '../services/exportService';

interface CsvEditorProps {
  parameters: EyeParameters[];
  onChange: (parameters: EyeParameters[]) => void;
}

export const CsvEditor: React.FC<CsvEditorProps> = ({ parameters, onChange }) => {
  const [csvText, setCsvText] = useState(() => parametersToCsv(parameters));
  const [dragActive, setDragActive] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync internal text state when external parameters change if not dirty
  const handleTextChange = (text: string) => {
    setCsvText(text);
    const result = parseCsvText(text);
    setParseErrors(result.errors);
    if (result.errors.length === 0 && result.parameters.length > 0) {
      onChange(result.parameters);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    downloadTextFile('pathlength_parameters.csv', parametersToCsv(parameters));
  };

  return (
    <div className="csv-editor-container">
      <div
        className={`csv-drop-zone ${dragActive ? 'drop-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <div className="drop-zone-content">
          <UploadCloud size={28} className="drop-zone-icon" />
          <div className="drop-zone-text">
            <strong>Drag and drop a parameter file (.csv, .txt)</strong> or click to browse
          </div>
          <span className="drop-zone-hint">
            Accepts standard 10-column PathLength CSV files (e.g. <code>nephrops_parameters.txt</code>)
          </span>
        </div>
      </div>

      <div className="csv-textarea-section">
        <div className="csv-header-row">
          <div className="csv-title-group">
            <FileText size={16} />
            <h4>Raw CSV Parameter Stream</h4>
            {justSaved && (
              <span className="live-sync-badge">
                <Check size={13} /> Synced
              </span>
            )}
          </div>

          <div className="csv-actions">
            <button
              type="button"
              className="action-btn secondary-btn small-btn"
              onClick={handleExportCsv}
              title="Download parameters as CSV"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="csv-format-hint">
          <strong>Format:</strong>{' '}
          <code>
            genus, rhabdom_length, rhabdom_width, eye_diameter, facet_width, aperture_diameter, cyto_ri, rhabdom_ri, blur_circle_extent, proximal_rhabdom_angle
          </code>
        </div>

        <textarea
          className="csv-raw-textarea"
          value={csvText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`nephropsfl,180,25,7800,50,3200,1.34,1.37,18,0\nnephropspl,180,25,7800,50,3200,1.34,1.37,18,12.5`}
          rows={7}
          spellCheck={false}
        />

        {parseErrors.length > 0 && (
          <div className="csv-error-box">
            <AlertCircle size={16} className="error-icon" />
            <div className="error-list">
              {parseErrors.map((err, i) => (
                <div key={i} className="error-item">
                  {err}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

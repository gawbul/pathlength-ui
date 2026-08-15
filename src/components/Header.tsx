import React from 'react';
import { Eye, BookOpen, Quote, Sparkles, Moon, Sun, Layers } from 'lucide-react';
import { PRESETS } from '../constants/presets';
import type { ParameterPreset } from '../types/simulation';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectPreset: (preset: ParameterPreset) => void;
  onOpenCitation: () => void;
  onOpenTheoryGuide: () => void;
  wasmReady: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleDarkMode,
  onSelectPreset,
  onOpenCitation,
  onOpenTheoryGuide,
  wasmReady,
}) => {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-container">
          <div className="brand-logo">
            <Eye className="logo-icon" size={26} />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <h1 className="brand-title">PathLength</h1>
              <span className="brand-badge">Superposition Optics</span>
              <span className={`engine-badge ${wasmReady ? 'wasm-ready' : 'wasm-loading'}`}>
                {wasmReady ? 'Go/Wasm Core' : 'TS Core'}
              </span>
            </div>
            <p className="brand-subtitle">
              Ray-tracing model for resolution & sensitivity in reflective superposition compound eyes
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="action-btn secondary-btn"
            onClick={onOpenTheoryGuide}
            title="View compound eye ray-tracing optics guide"
          >
            <BookOpen size={16} />
            <span>Theory & Optics Guide</span>
          </button>

          <button
            type="button"
            className="action-btn secondary-btn"
            onClick={onOpenCitation}
            title="View academic citations & BibTeX"
          >
            <Quote size={16} />
            <span>Citation</span>
          </button>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <div className="header-presets-bar">
        <div className="presets-label">
          <Sparkles size={14} />
          <span>Load Preset Dataset:</span>
        </div>
        <div className="preset-buttons">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-chip"
              onClick={() => onSelectPreset(preset)}
              title={preset.description}
            >
              <Layers size={13} />
              <span className="preset-name">{preset.name}</span>
              <span className="preset-count">({preset.parameters.length} runs)</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

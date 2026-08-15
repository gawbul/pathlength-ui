import React, { useState } from 'react';
import { X, Check, Copy, BookMarked, ExternalLink } from 'lucide-react';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ isOpen, onClose }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const apaCitation = `Gaten, E., Moss, S., & Johnson, M. (2013). The Reniform Reflecting Superposition Compound Eyes of Nephrops Norvegicus: Optics, Susceptibility to Light-Induced Damage, Electrophysiology and a Ray Tracing Model. In M. L. Johnson & M. P. Johnson (Eds.), Advances in Marine Biology: The Ecology and Biology of Nephrops norvegicus (Vol. 107, pp. 107–148). Academic Press.`;

  const bibtexCitation = `@incollection{Gaten2013,
  title = {The Reniform Reflecting Superposition Compound Eyes of Nephrops Norvegicus: Optics, Susceptibility to Light-Induced Damage, Electrophysiology and a Ray Tracing Model},
  author = {Gaten, Edward and Moss, Stephen and Johnson, Magnus},
  booktitle = {Advances in Marine Biology: The Ecology and Biology of Nephrops norvegicus},
  editor = {Johnson, Magnus L. and Johnson, Mark P.},
  volume = {107},
  pages = {107--148},
  year = {2013},
  publisher = {Academic Press},
  doi = {10.1016/B978-0-12-410466-2.00004-9}
}`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <BookMarked size={22} className="modal-icon" />
            <h2>Academic Citation & Program Credits</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-intro">
            If you use the <strong>PathLength</strong> ray-tracing model or simulation results in academic
            publications, theses, or research projects, please cite the primary research paper:
          </p>

          <div className="citation-card">
            <div className="citation-card-header">
              <span className="citation-format-label">APA 7th Edition</span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(apaCitation, 'apa')}
              >
                {copiedType === 'apa' ? (
                  <>
                    <Check size={14} className="success-icon" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy APA
                  </>
                )}
              </button>
            </div>
            <p className="citation-text">{apaCitation}</p>
          </div>

          <div className="citation-card">
            <div className="citation-card-header">
              <span className="citation-format-label">BibTeX Reference</span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(bibtexCitation, 'bibtex')}
              >
                {copiedType === 'bibtex' ? (
                  <>
                    <Check size={14} className="success-icon" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy BibTeX
                  </>
                )}
              </button>
            </div>
            <pre className="bibtex-code">
              <code>{bibtexCitation}</code>
            </pre>
          </div>

          <div className="credits-section">
            <h3>Development & Heritage</h3>
            <ul className="credits-list">
              <li>
                <strong>Golang Engine & Web UI (2025–2026):</strong> Dr. Stephen P. Moss (
                <a href="https://www.gawbul.io" target="_blank" rel="noopener noreferrer">
                  gawbul.io <ExternalLink size={12} />
                </a>
                )
              </li>
              <li>
                <strong>Original QBASIC Ray-Tracing Model (1995):</strong> Dr. Magnus L. Johnson & Genevre Parker
              </li>
              <li>
                <strong>License:</strong> GNU General Public License v3.0 (GPL-3.0)
              </li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="action-btn primary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

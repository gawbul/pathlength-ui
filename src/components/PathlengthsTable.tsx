import React, { useMemo, useState } from 'react';
import { Download, Search, Filter } from 'lucide-react';
import { downloadTextFile } from '../services/exportService';

interface PathlengthsTableProps {
  speciesName: string;
  pathlengthsCsv: string;
}

interface PathlengthBlock {
  blockIndex: number;
  shielding: string;
  tapetal: string;
  rows: string[][];
}

export const PathlengthsTable: React.FC<PathlengthsTableProps> = ({
  speciesName,
  pathlengthsCsv,
}) => {
  const [selectedBlock, setSelectedBlock] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  // The engine emits a tidy CSV with one row per rhabdom, each carrying its own
  // block and facet keys. Pivot it back into one row per facet for display.
  const blocks = useMemo<PathlengthBlock[]>(() => {
    const parsedBlocks: PathlengthBlock[] = [];

    for (const rawLine of pathlengthsCsv.split('\n')) {
      const line = rawLine.trim();
      // Skip blank lines and the header row.
      if (!line || line.startsWith('block,')) continue;

      const [blockField, shielding, tapetal, facetField, rhabdomField, pathlength] =
        line.split(',');
      const blockIndex = Number(blockField);
      const facet = Number(facetField);
      const rhabdom = Number(rhabdomField);
      if (!Number.isInteger(blockIndex) || !Number.isInteger(facet) || !Number.isInteger(rhabdom)) {
        continue;
      }

      let block = parsedBlocks[blockIndex];
      if (!block) {
        block = { blockIndex, shielding, tapetal, rows: [] };
        parsedBlocks[blockIndex] = block;
      }
      if (!block.rows[facet]) block.rows[facet] = [];
      block.rows[facet][rhabdom] = pathlength;
    }

    return parsedBlocks.filter(Boolean);
  }, [pathlengthsCsv]);

  const activeBlock = blocks[selectedBlock] || blocks[0];

  const filteredRows = useMemo(() => {
    if (!activeBlock) return [];
    if (!searchTerm) return activeBlock.rows;
    return activeBlock.rows.filter((row, idx) =>
      `Facet ${idx} ${row.join(' ')}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeBlock, searchTerm]);

  const handleDownload = () => {
    downloadTextFile(`${speciesName}_pathlengths.csv`, pathlengthsCsv);
  };

  return (
    <div className="pathlengths-table-container">
      <div className="pathlengths-toolbar">
        <div className="block-selector-group">
          <Filter size={15} />
          <label htmlFor="block-select" className="filter-label">Pigment Block State:</label>
          <select
            id="block-select"
            className="block-select"
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(parseInt(e.target.value, 10))}
          >
            {blocks.map((b, idx) => (
              <option key={idx} value={idx}>
                Block #{idx + 1}: P={parseFloat(b.shielding).toFixed(1)} µm, T={parseFloat(b.tapetal).toFixed(1)} µm
              </option>
            ))}
          </select>
        </div>

        <div className="table-search-group">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Filter facet rows or values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="action-btn secondary-btn small-btn"
          onClick={handleDownload}
          title="Download full pathlengths CSV file"
        >
          <Download size={14} />
          <span>Download Raw Pathlengths ({blocks.length} Blocks)</span>
        </button>
      </div>

      {activeBlock && (
        <div className="block-meta-banner">
          <span>
            Current Block: <strong>Shielding (P) = {parseFloat(activeBlock.shielding).toFixed(2)} µm</strong> |{' '}
            <strong>Tapetal (T) = {parseFloat(activeBlock.tapetal).toFixed(2)} µm</strong> |{' '}
            <strong>{activeBlock.rows.length} Facets</strong>
          </span>
        </div>
      )}

      <div className="table-scroll-container">
        <table className="raw-facet-table">
          <thead>
            <tr>
              <th className="th-facet-idx">Facet</th>
              {Array.from({
                length: Math.max(...(activeBlock?.rows.map((r) => r.length) || [1])),
              }).map((_, i) => (
                <th key={i}>Rhabdom #{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="td-facet-idx">Facet {rowIdx}</td>
                {row.map((val, colIdx) => (
                  <td key={colIdx} className={parseFloat(val) === 0 ? 'zero-val' : 'active-val'}>
                    {parseFloat(val).toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

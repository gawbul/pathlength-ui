import React from 'react';
import { X, BookOpen, Layers, Compass, HelpCircle } from 'lucide-react';

interface TheoryGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TheoryGuideModal: React.FC<TheoryGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <BookOpen size={22} className="modal-icon" />
            <h2>Reflective Superposition Eye Optics & Theory Guide</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body modal-scroll">
          <section className="theory-section">
            <h3>1. Principles of Reflective Superposition Optics</h3>
            <p>
              Reflective superposition compound eyes (found in decapod crustaceans like lobsters, deep-sea
              shrimps, and mysids) focus light across a wide aperture using square-section mirrored facet
              cones. Instead of each ommatidium forming an independent image (like in apposition eyes),
              light rays from hundreds of facets converge across an unpigmented <em>clear zone</em> onto a
              single common image point on the underlying rhabdom retina.
            </p>
          </section>

          <section className="theory-section">
            <h3>2. Parameter Reference & Physical Units</h3>
            <div className="table-wrapper">
              <table className="theory-table">
                <thead>
                  <tr>
                    <th>Parameter Field</th>
                    <th>Unit</th>
                    <th>Biological Meaning & Typical Range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>Species / Genus</code></td>
                    <td>Text</td>
                    <td>Unique identifier string for the organism run (e.g. <code>nephropsfl</code>).</td>
                  </tr>
                  <tr>
                    <td><code>Rhabdom Length</code></td>
                    <td>µm</td>
                    <td>Photoreceptor sensory structure length (typically 100–250 µm).</td>
                  </tr>
                  <tr>
                    <td><code>Rhabdom Width</code></td>
                    <td>µm</td>
                    <td>Diameter of individual rhabdom waveguide (typically 10–35 µm).</td>
                  </tr>
                  <tr>
                    <td><code>Eye Diameter</code></td>
                    <td>µm</td>
                    <td>Total spherical/reniform eye hemisphere diameter (1,000–10,000 µm).</td>
                  </tr>
                  <tr>
                    <td><code>Facet Width</code></td>
                    <td>µm</td>
                    <td>Square facet mirror width across the corneal surface (20–60 µm).</td>
                  </tr>
                  <tr>
                    <td><code>Aperture Diameter</code></td>
                    <td>µm</td>
                    <td>Diameter of the functional optical eyeshine entrance pupil (500–4,000 µm).</td>
                  </tr>
                  <tr>
                    <td><code>Cytoplasm RI (n<sub>cyto</sub>)</code></td>
                    <td>Index</td>
                    <td>Surrounding cytoplasm medium refractive index (standard ~1.34).</td>
                  </tr>
                  <tr>
                    <td><code>Rhabdom RI (n<sub>rhab</sub>)</code></td>
                    <td>Index</td>
                    <td>Photoreceptor waveguide refractive index (standard ~1.37).</td>
                  </tr>
                  <tr>
                    <td><code>Blur Circle Extent</code></td>
                    <td>Rhabdoms</td>
                    <td>
                      Width of the blur circle, in rhabdoms. 1 is a perfect point focus; the
                      outermost facet of the eyeshine patch is displaced by (extent &minus; 1)
                      rhabdoms. It cannot exceed the number of facets across the patch, since
                      the light would then have to fill rhabdom offsets that no facet reaches.
                    </td>
                  </tr>
                  <tr>
                    <td><code>Proximal Rhabdom Angle</code></td>
                    <td>Degrees (°)</td>
                    <td>Tapering entrance angle for pointy-ended rhabdom morphologies (0° to 15°).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="theory-section">
            <h3>3. Pigment Dynamics & 11×11 Matrix Output</h3>
            <p>
              The simulation models the diurnal light/dark adaptation state by varying two separate pigment
              layers across 11 discrete steps from 0% (retracted) to 100% (fully extended across rhabdom length):
            </p>
            <div className="theory-grid-2">
              <div className="theory-card">
                <div className="theory-card-title">
                  <Layers size={16} />
                  <h4>Shielding Pigment (Rows: 0 to 10)</h4>
                </div>
                <p>
                  Screening pigment that migrates down the sides of the crystalline cones and clear zone to
                  absorb stray off-axis light in bright sunlight conditions, sharpening visual resolution at
                  the cost of sensitivity.
                </p>
              </div>

              <div className="theory-card">
                <div className="theory-card-title">
                  <Compass size={16} />
                  <h4>Tapetal Pigment (Columns: 0 to 10)</h4>
                </div>
                <p>
                  Reflective diffuse backing layer situated beneath the rhabdom array. When exposed in dark
                  conditions, unabsorbed rays undergo a second pass back through the rhabdom, substantially
                  boosting quantum photon capture.
                </p>
              </div>
            </div>
          </section>

          <section className="theory-section">
            <h3>4. Ray-Tracing Physics & Waveguide Boundary Cases</h3>
            <p>
              For each of the 121 pigment states, incident rays across every facet are refracted at the curved
              corneal surface, corrected for corneal light loss, and traced into the rhabdom cylinder:
            </p>
            <ul className="physics-cases">
              <li>
                <strong>Critical Angle (&theta;<sub>c</sub>):</strong> Total internal reflection boundary determined by
                Snell's Law:
                <br />
                <code>&theta;<sub>c</sub> = 90&deg; - arcsin(n<sub>cyto</sub> / n<sub>rhab</sub>)</code>
              </li>
              <li>
                <strong>Case 1 (Wall Transmission):</strong> Ray enters at an angle steeper than &theta;<sub>c</sub>,
                traversing into adjacent rhabdoms and contributing to peripheral light capture.
              </li>
              <li>
                <strong>Case 2 (Edge Reflection):</strong> Ray experiences total internal reflection off the
                rhabdom boundary wall when <code>boa &lt; &theta;<sub>c</sub></code>.
              </li>
              <li>
                <strong>Case 3 (Base Bounce):</strong> Ray reaches the bottom tapetal layer and reflects back up
                the photoreceptor column.
              </li>
              <li>
                <strong>Case 4 (Perpendicular Ray):</strong> Central optic axis ray traversing straight through
                the rhabdom without wall collisions.
              </li>
            </ul>
          </section>

          <section className="theory-section">
            <h3>5. Resolution & Sensitivity Calculations</h3>
            <p>
              <strong>Sensitivity (S):</strong> Calculated by integrating relative absorbance across all
              rhabdoms (<code>A = 1 - exp(-0.01 &times; pathlength)</code>) normalized by the incident aperture torus area.
            </p>
            <p>
              <strong>Resolution (R):</strong> Determined by locating the half-power optical axis cutoff (<code>xz - halfwayPoint</code>) multiplied by 200, representing the angular optical acceptance angle.
            </p>
          </section>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-tip">
            <HelpCircle size={14} />
            <span>Tip: Switch between the 2D Matrix Heatmap and Trade-off curve to evaluate optical optimization.</span>
          </div>
          <button type="button" className="action-btn primary-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

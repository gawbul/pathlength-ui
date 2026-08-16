# Superposition Eye PathLength Web UI

A modern, high-performance web interface for the **PathLength** ray-tracing model, calculating resolution and sensitivity in reflective superposition compound eyes (Gaten, Moss & Johnson, 2013; Moss, 2025).

The application runs the pure mathematical simulation engine in the browser using **Go WebAssembly (Wasm)** with zero backend requirements, instant client-side execution, offline capability, interactive scientific heatmaps, and batch CSV/ZIP export.

---

## Key Features

- **Client-Side WebAssembly Engine**: The Go simulation engine from `../pathlength` is compiled directly to WebAssembly (`GOOS=js GOARCH=wasm`), ensuring 100% deterministic accuracy with instantaneous in-browser execution.
- **Dual Input Workflow**:
  - **Interactive Parameter Grid**: Multi-row editable spreadsheet with live optical validation, add/duplicate/delete row actions.
  - **CSV File Upload & Stream**: Drag-and-drop support for `.csv` and `.txt` files with live syntax validation and bidirectional synchronization.
- **Preloaded Scientific Datasets**:
  - *Nephrops norvegicus* (Norway Lobster) — 4 comparative morphologies (FL, PL, FA, PA).
  - *Acanthephyra purpurea* (Deep-sea Oplophorid Shrimp) — Blur circle extent variations (1, 3, 6).
  - *Astacodes* — Standard benchmark model.
- **Interactive Visualizations & Data Analysis**:
  - **11×11 Dynamic Matrix Heatmaps**: Perceptually uniform scientific colormaps (*Viridis*, *Turbo*, *Plasma*, *Inferno*, *Oceanic*) for the acceptance angle (FWHM of the point spread function, in degrees) and the sensitivity (percentage of incident light absorbed, area-weighted over the eyeshine patch). Rows vary the shielding (proximal screening) pigment, columns the tapetal (reflecting) pigment. A cell shown as `n/a` is a pigment state whose profile never falls to half its maximum, so its acceptance angle is undefined.
  - **Dynamic Cell Inspector**: Hover over any of the 121 pigment states to inspect exact physical lengths ($\mu m$), steps ($0..10$), and values.
  - **Adaptation Trade-off Curve (Scatter Plot)**: Visualizes the optical Pareto frontier between dark-adapted sensitivity and light-adapted spatial acuity.
  - **Derived Optical Constants Card**: Calculates eye radius ($R_{eye}$), aperture radius ($R_{ap}$), ommatidial acceptance angle ($\Delta\phi$), number of facets ($N_{facets}$), and Snell's Law critical TIR angle ($\theta_c$).
  - **Facet Pathlength Table**: Searchable, paginated viewer for raw ray-tracing pathlength blocks.
- **Batch Export**:
  - **1-Click Download All (ZIP)**: Generates a complete archive containing `[species]_summary_res.csv`, `[species]_summary_sen.csv`, `[species]_pathlengths.csv`, optional `[species]_debug.csv`, `input_parameters.csv`, and a structured `simulation_report.json`.
  - Individual CSV download and clipboard copy (CSV & Excel TSV).
- **Academic Citation & Theory Guide**:
  - In-app modal with 1-click BibTeX and APA citation copy.
  - Interactive theory guide explaining superposition optics, pigment migration dynamics, and waveguiding cases.
- **Modern UI & Theming**:
  - Light & Dark mode support.
  - Responsive, accessible design with zero external heavy UI frameworks.

---

## Required Input Parameters

PathLength accepts a 10-column CSV stream where each row specifies an organism's optical parameters:

```csv
genus, rhabdom_length, rhabdom_width, eye_diameter, facet_width, aperture_diameter, cyto_ri, rhabdom_ri, blur_circle_extent, proximal_rhabdom_angle
```

| Parameter | Unit | Description | Example |
| :--- | :--- | :--- | :--- |
| `speciesName` | string | Lowercase alphanumeric run identifier | `nephropsfl` |
| `rhabdomLength` | $\mu m$ | Length of photoreceptor waveguide | `180` |
| `rhabdomWidth` | $\mu m$ | Width/diameter of rhabdom cylinder | `25` |
| `eyeDiameter` | $\mu m$ | Total eye hemisphere diameter | `7800` |
| `facetWidth` | $\mu m$ | Width of corneal mirror facet | `50` |
| `apertureDiameter` | $\mu m$ | Eyeshine entrance pupil diameter | `3200` |
| `cytoplasmRefractiveIndex` | index | Surrounding cytoplasm medium RI ($n_{cyto}$) | `1.34` |
| `rhabdomRefractiveIndex` | index | Photoreceptor rhabdom RI ($n_{rhab}$) | `1.37` |
| `blurCircleExtent` | rhabdoms | Width of the blur circle. 1 is a point focus; the outermost facet is displaced by (extent $-$ 1) rhabdoms. Must not exceed the facet count across the eyeshine patch | `18` |
| `proximalRhabdomAngle` | degrees | Proximal entrance taper angle for pointy rhabdoms | `0` or `12.5` |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Go compiler](https://go.dev/) (v1.22+ recommended, required to compile the WebAssembly engine)

### Install Dependencies

```bash
npm install
```

### Run Locally in Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build WebAssembly Engine & Production Bundle

```bash
npm run build
```

This compiles:
1. `wasm/main.go` into `public/pathlength.wasm` using `GOOS=js GOARCH=wasm go build`
2. TypeScript validation (`tsc -b`)
3. Optimized Vite production bundle in `dist/`

---

## Citation

If you use this software in academic work, please cite:

> Gaten, E., Moss, S., & Johnson, M. (2013). The Reniform Reflecting Superposition Compound Eyes of *Nephrops norvegicus*: Optics, Susceptibility to Light-Induced Damage, Electrophysiology and a Ray Tracing Model. In M. L. Johnson & M. P. Johnson (Eds.), *Advances in Marine Biology: The Ecology and Biology of Nephrops norvegicus* (Vol. 107, pp. 107–148). Academic Press.

### BibTeX

```bibtex
@incollection{Gaten2013,
  title = {The Reniform Reflecting Superposition Compound Eyes of Nephrops Norvegicus: Optics, Susceptibility to Light-Induced Damage, Electrophysiology and a Ray Tracing Model},
  author = {Gaten, Edward and Moss, Stephen and Johnson, Magnus},
  booktitle = {Advances in Marine Biology: The Ecology and Biology of Nephrops norvegicus},
  editor = {Johnson, Magnus L. and Johnson, Mark P.},
  volume = {107},
  pages = {107--148},
  year = {2013},
  publisher = {Academic Press},
  doi = {10.1016/B978-0-12-410466-2.00004-9}
}
```

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html).

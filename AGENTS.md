# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

PathLength Web UI is a browser front end for the PathLength ray tracing model, which
calculates the resolution and sensitivity of reflective superposition compound eyes
(found in crustaceans like Nephrops norvegicus). The simulation runs entirely in the
browser: the Go engine is compiled to WebAssembly and there is no backend.

Two sibling repositories hold the standalone command line implementations of the same
model, `pathlength` (Go) and `pathlength-rs` (Rust). They are the authority on the
physics and on the output file formats. This repository is the interface, plus its own
copy of the engine.

## Development Commands

### Install dependencies
```bash
npm install
```

### Run the development server
```bash
npm run dev
```
Serves on http://localhost:5173. Uses the `public/pathlength.wasm` already committed to
the repository, so a Go toolchain is not needed just to run the UI.

### Build
```bash
npm run build
```
Runs three steps in order: `build:wasm` (compiles `wasm/` to `public/pathlength.wasm`
with `GOOS=js GOARCH=wasm`), `tsc -b`, then `vite build` into `dist/`. **This step needs
a Go toolchain installed**, unlike `npm run dev`.

### Compile the WebAssembly engine only
```bash
npm run build:wasm
```

### Test
```bash
npm test              # vitest, covers the TypeScript engine
cd wasm && go test ./...   # covers the Go engine
```
**Both suites must be run.** See "The two engines" below.

### Lint and typecheck
```bash
npm run lint    # oxlint
npx tsc -b      # typecheck without emitting
```
`npm run lint` currently reports four pre-existing warnings, in `src/services/wasmRunner.ts`,
`public/wasm_exec.js` and `src/App.tsx`. New code should not add to them.

### Preview a production build
```bash
npm run preview
```

## Development Workflow

**IMPORTANT: Always run both test suites before committing changes.**

Unlike the `pathlength` and `pathlength-rs` repositories, this project has **no
pre-commit hooks**. Nothing runs automatically on commit, so `npx tsc -b`,
`npm test`, `cd wasm && go test ./...` and `npm run lint` are all manual.

CI (`.github/workflows/deploy.yml`) runs `npm ci` and `npm run build` on every push to
`main`, then deploys `dist/` to GitHub Pages. It does not run the test suites, so a
broken test will not be caught before it reaches production.

### Commit Message Format

Use conventional commit format for all commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no functional changes)
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `chore`: Maintenance tasks (dependencies, build config, etc.)
- `perf`: Performance improvements

## The two engines

**This is the most important thing to know about this repository.** The model is
implemented twice:

1. **`wasm/engine.go`** - the Go engine, compiled to WebAssembly. `wasm/main.go` binds
   `runPathlengthSimulation` onto the JS global in its `main()`.
2. **`src/services/tsEngine.ts`** - a pure TypeScript reimplementation of the same
   physics.

`src/services/wasmRunner.ts` prefers the WebAssembly engine and **falls back to the
TypeScript engine silently**, emitting only a `console.warn`. The fallback triggers
when the `.wasm` fails to load, when the engine returns an error, or when the call
throws. A user seeing results has no indication of which engine produced them:
`isWasmEngineActive()` is exported for the purpose but is currently called nowhere, so
the only signal is a warning in the browser console.

The consequence: **a change to the physics in one engine that is not mirrored in the
other produces results that differ depending on whether WebAssembly happened to load.**
That is a difficult failure to spot, because both paths return plausible numbers.

The two implementations share function names deliberately, so changes have an obvious
counterpart: `validateParameters`, `refractedAngle`, `ringArea`, `deposit` and
`summariseBlock` all exist in both. Each has its own tests, `wasm/engine_test.go` and
`src/services/tsEngine.test.ts`, and both must pass.

## Code Architecture

### `src/services/`
- **`wasmRunner.ts`** - engine selection, WASM initialisation, fallback. `runSimulations()`
  matches results to inputs by species name rather than by position, because the engine
  rejects parameter sets that cannot describe a real eye and so may return fewer results
  than it was given
- **`tsEngine.ts`** - the TypeScript engine (see above)
- **`csvParser.ts`** - `parseCsvText()`, `parametersToCsv()`, `validateParameter()`. Handles
  the 10-column parameter format shared with the CLI repositories
- **`exportService.ts`** - `downloadTextFile()` and `exportAllResultsZip()`, which builds
  the archive of CSVs plus `input_parameters.csv` and `simulation_report.json`

### `src/components/`
- **`ResultsDashboard.tsx`** - tabbed results shell: overview, the two matrices, trade-off
  plot, raw pathlengths, optional debug log
- **`HeatmapViewer.tsx`** - the 11x11 matrix heatmaps with colormaps and cell inspector
- **`ParameterGrid.tsx`** / **`CsvEditor.tsx`** - the two input paths, kept in sync
- **`OpticalStatsCard.tsx`**, **`TradeoffPlot.tsx`**, **`PathlengthsTable.tsx`**,
  **`TheoryGuideModal.tsx`**, **`CitationModal.tsx`**, **`Header.tsx`**

### `src/constants/presets.ts`
The bundled example datasets. Note the distinction between two fields:

- **`speciesName`** is a **data key**, not a label. It is written into the parameter CSV
  handed to the engine and determines the output filenames (`astacodes_summary_res.csv`),
  which must keep matching `example_data/*_parameters.txt` in the `pathlength` and
  `pathlength-rs` repositories. Changing it is a cross-repository change.
- **`name`**, **`description`** and **`category`** are display-only and safe to edit.

### `src/types/simulation.ts`
Shared types, including `EyeParameters`, `SimulationResult` and `ViewTab`.

### `wasm/`
Go module (`pathlength-wasm`), separate from the npm project. `engine.go` holds the model,
`main.go` the JS bindings, `engine_test.go` the tests.

## Output Files

For each parameter set with species name "X", the app produces:
- `X_pathlengths.csv` - raw ray geometry in µm, a rectangular CSV with the header
  `block,shielding_um,tapetal_um,facet,rhabdom,pathlength_um`
- `X_summary_res.csv` - acceptance angle (FWHM of the point spread function), degrees
- `X_summary_sen.csv` - incident light absorbed, percent (0-100)
- `X_debug.csv` - optional, one row per traced ray

Both summary files are 11x11: **rows vary the shielding (proximal screening) pigment,
columns vary the tapetal (reflecting) pigment**. A resolution cell shown as `n/a` in the
UI (`NaN` in the CSV) is a pigment state with no acceptance angle: it either absorbs no
light, or its profile is annular, dipping below half its maximum on the optic axis so
the light forms a ring rather than a central spot.

In the UI this matrix is labelled **"Resolution (Acceptance Angle) Matrix"**. Keep the
tab button and both headings in `ResultsDashboard.tsx` on the same wording; they drifted
apart once already.

The summary files changed units and format and are **not comparable with output from
earlier releases**. `pathlength/AGENTS.md` and `pathlength-rs/AGENTS.md` carry the full
explanation; do not duplicate it here, as it will drift.

## Key Implementation Notes

- `public/pathlength.wasm` is committed. If you change `wasm/`, rebuild it with
  `npm run build:wasm` and commit the result, or the deployed app will keep running the
  old engine
- `public/wasm_exec.js` is vendored from the Go distribution. Do not hand-edit it; replace
  it wholesale when upgrading Go
- The absorption coefficient is fixed at 0.01 µm⁻¹ and tapetal reflectance at 1.0, matching
  the CLI implementations
- The blur circle extent may not exceed the facet count across the eyeshine patch. The
  engine rejects parameter sets that violate this rather than producing NaNs
- There are no component tests, only engine tests. UI changes are verified by running the
  app

## Citation

When using this program, cite:
Gaten, E., Moss, S., Johnson, M. 2013. The Reniform Reflecting Superposition Compound Eyes of Nephrops Norvegicus: Optics, Susceptibility to Light-Induced Damage, Electrophysiology and a Ray Tracing Model. In: M. L. Johnson and M. P. Johnson, ed(s). Advances in Marine Biology: The Ecology and Biology of Nephrops norvegicus. Oxford: Academic Press, 107:148.

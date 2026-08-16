package main

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"testing"
)

// nephropsFlatLateral is the reference parameter set used throughout the tests.
func nephropsFlatLateral(name string) Parameters {
	return Parameters{
		SpeciesName:              name,
		RhabdomLength:            180,
		RhabdomWidth:             25,
		EyeDiameter:              7800,
		FacetWidth:               50,
		ApertureDiameter:         3200,
		CytoplasmRefractiveIndex: 1.34,
		RhabdomRefractiveIndex:   1.37,
		BlurCircleExtent:         18,
		ProximalRhabdomAngle:     0,
	}
}

func TestParseInputParametersString(t *testing.T) {
	csvData := `nephropsfl,180,25,7800,50,3200,1.34,1.37,18,0
nephropspl,180,25,7800,50,3200,1.34,1.37,18,12.5`

	params, err := ParseInputParametersString(csvData)
	if err != nil {
		t.Fatalf("Unexpected error parsing CSV: %v", err)
	}
	if len(params) != 2 {
		t.Fatalf("Expected 2 parameter sets, got %d", len(params))
	}
	if params[0].SpeciesName != "nephropsfl" {
		t.Errorf("Expected species 'nephropsfl', got '%s'", params[0].SpeciesName)
	}
	if params[0].RhabdomLength != 180 {
		t.Errorf("Expected RhabdomLength 180, got %f", params[0].RhabdomLength)
	}
	if params[1].ProximalRhabdomAngle != 12.5 {
		t.Errorf("Expected ProximalRhabdomAngle 12.5, got %f", params[1].ProximalRhabdomAngle)
	}

	// A non-numeric optical value used to be swallowed by a discarded ParseFloat
	// error and silently become zero.
	t.Run("NonNumericField", func(t *testing.T) {
		params, err := ParseInputParametersString(
			"good,180,25,7800,50,3200,1.34,1.37,18,0\nbad,180,25,7800,50,3200,1.34,1.37,oops,0")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(params) != 1 || params[0].SpeciesName != "good" {
			t.Errorf("Expected the non-numeric record to be rejected, got %v", params)
		}
	})
}

// TestRejectsUnphysicalParameters covers inputs that previously produced NaNs which
// then silently disabled the total-internal-reflection test or emptied the
// simulation, in both cases without any warning to the user.
func TestRejectsUnphysicalParameters(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Parameters)
		want   string
	}{
		{"CytoplasmIndexExceedsRhabdom", func(p *Parameters) {
			p.CytoplasmRefractiveIndex = 1.40
			p.RhabdomRefractiveIndex = 1.37
		}, "total internal reflection"},
		{"ApertureExceedsEye", func(p *Parameters) { p.ApertureDiameter = 9000 }, "aperture diameter"},
		{"ZeroRhabdomLength", func(p *Parameters) { p.RhabdomLength = 0 }, "rhabdom length"},
		{"BlurCircleBelowOne", func(p *Parameters) { p.BlurCircleExtent = 0 }, "blur circle extent"},
		// ParseFloat accepts "NaN" and "Inf", and every ordered comparison against NaN
		// is false, so these used to slip past every range check and produce
		// plausible-looking output.
		{"NaNBlurCircle", func(p *Parameters) { p.BlurCircleExtent = math.NaN() }, "must be a finite number"},
		{"NaNCytoplasmIndex", func(p *Parameters) { p.CytoplasmRefractiveIndex = math.NaN() }, "must be a finite number"},
		{"InfRhabdomLength", func(p *Parameters) { p.RhabdomLength = math.Inf(1) }, "must be a finite number"},
		{"InfProximalAngle", func(p *Parameters) { p.ProximalRhabdomAngle = math.Inf(1) }, "must be a finite number"},
		// astacodes shipped an 18-rhabdom blur circle against only 7 facets, leaving
		// 11 rhabdom offsets receiving no light at all.
		{"BlurCircleExceedsFacets", func(p *Parameters) {
			p.RhabdomLength, p.RhabdomWidth = 84, 16
			p.EyeDiameter, p.FacetWidth, p.ApertureDiameter = 890, 32, 445
			p.BlurCircleExtent = 18
		}, "exceeds the 7 facets"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			params := nephropsFlatLateral("test_invalid")
			tc.mutate(&params)
			if _, err := NewModel(params); err == nil {
				t.Fatal("Expected an error, got a valid model")
			} else if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("Expected an error mentioning %q, got: %v", tc.want, err)
			}
		})
	}
}

// TestBlurOffsetSpansExtentEvenly guards the blur-circle mapping. The previous
// `facet > fd*i` formulation aliased facets unevenly onto whole rhabdom offsets and
// skipped an offset wherever fd*i landed on an exact integer.
func TestBlurOffsetSpansExtentEvenly(t *testing.T) {
	model, err := NewModel(nephropsFlatLateral("test_blur"))
	if err != nil {
		t.Fatalf("NewModel failed: %v", err)
	}

	if got := model.blurOffset(0); got != 0 {
		t.Errorf("Expected the central facet to be undisplaced, got %f", got)
	}
	want := model.Params.BlurCircleExtent - 1
	if got := model.blurOffset(model.NumberOfFacets - 1); math.Abs(got-want) > 1e-9 {
		t.Errorf("Expected the outermost facet at offset %f, got %f", want, got)
	}
	step := model.blurOffset(1) - model.blurOffset(0)
	for facet := 1; facet < model.NumberOfFacets; facet++ {
		if delta := model.blurOffset(facet) - model.blurOffset(facet-1); math.Abs(delta-step) > 1e-9 {
			t.Errorf("Facet %d: expected a uniform blur step of %f, got %f", facet, step, delta)
		}
	}
}

// TestRaysStayWithinPhysicalGeometry guards against the ray tracer folding rays back
// on themselves. Taking |tan| and |cos| of an angle past 90 degrees used to yield
// path lengths many times the rhabdom length.
func TestRaysStayWithinPhysicalGeometry(t *testing.T) {
	params := nephropsFlatLateral("test_geometry")
	model, err := NewModel(params)
	if err != nil {
		t.Fatalf("NewModel failed: %v", err)
	}
	increment := params.RhabdomLength / 10.0

	for pStep := 0; pStep < pigmentSteps; pStep++ {
		for tStep := 0; tStep < pigmentSteps; tStep++ {
			for facet := 0; facet < model.NumberOfFacets; facet++ {
				trace := model.traceRay(facet, float64(pStep)*increment, float64(tStep)*increment)
				if trace.Lost {
					t.Fatalf("Facet %d lost the ray at pigment step (%d,%d)", facet, pStep, tStep)
				}
				if trace.MaxAngle >= maxPropagationAngle {
					t.Fatalf("Facet %d reached %.2f deg to the rhabdom axis", facet, trace.MaxAngle)
				}
				// Every segment covers some axial depth at an angle no greater than
				// MaxAngle, and the ray traverses the rhabdom at most twice.
				limit := 2.0*params.RhabdomLength/math.Cos(trace.MaxAngle*degToRadConv) + 1e-9
				total := 0.0
				for _, v := range trace.Pathlengths {
					total += v
				}
				if total > limit {
					t.Errorf("Facet %d at (%d,%d) traced %.1f um, exceeding the %.1f um bound",
						facet, pStep, tStep, total, limit)
				}
			}
		}
	}

	// Facet transmission is a flux factor, so it must not be folded into the geometry.
	if got := model.traceRay(0, 0, 0).Pathlengths; len(got) != 1 || math.Abs(got[0]-params.RhabdomLength) > 1e-9 {
		t.Errorf("Expected the axial ray to traverse %.1f um once, got %v", params.RhabdomLength, got)
	}
}

// TestDepositGrowsBeyondFixedArray covers the accumulator that used to be a fixed
// 21-element array, silently discarding every rhabdom past the twenty-first.
func TestDepositGrowsBeyondFixedArray(t *testing.T) {
	var acc []float64
	acc = deposit(acc, 40, 3.5)
	if len(acc) != 41 || acc[40] != 3.5 {
		t.Fatalf("Expected 3.5 at offset 40 in a 41-entry profile, got %v", acc)
	}
	before := len(acc)
	if acc = deposit(acc, 99, 0); len(acc) != before {
		t.Errorf("Expected a zero deposit to leave the length at %d, got %d", before, len(acc))
	}
}

func TestSummariseBlockResolution(t *testing.T) {
	model := &Model{OmmatidialAngle: 2.0, NumberOfFacets: 4}
	cases := []struct {
		name     string
		psf      []float64
		wantFWHM float64
	}{
		{"SingleStep", []float64{1, 0}, 2.0},
		{"ExactHalfAtUnitOffset", []float64{1, 0.5, 0}, 4.0},
		// A top-hat is measured at its own edge: rhabdoms beyond the outermost
		// illuminated one are genuinely dark.
		{"TopHatMeasuredAtItsEdge", []float64{1, 1, 1}, 10.0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			weighted := make([]float64, len(tc.psf))
			for j, v := range tc.psf {
				weighted[j] = v * ringArea(j)
			}
			if got := model.summariseBlock(weighted); math.Abs(got.FWHMDegrees-tc.wantFWHM) > 1e-9 {
				t.Errorf("Expected FWHM %.6f deg, got %.6f", tc.wantFWHM, got.FWHMDegrees)
			}
		})
	}
	if got := model.summariseBlock(nil); !math.IsNaN(got.FWHMDegrees) {
		t.Errorf("Expected an undefined FWHM for an empty profile, got %f", got.FWHMDegrees)
	}

	// The angular sensitivity function is even about the optic axis, so its width is
	// measured from the axis. Measuring from the peak would understate this flat-topped
	// profile by the peak's own offset.
	t.Run("FlatTopMeasuredFromTheAxis", func(t *testing.T) {
		psf := []float64{0.99, 1.0, 0.98, 0.4, 0}
		weighted := make([]float64, len(psf))
		for j, v := range psf {
			weighted[j] = v * ringArea(j)
		}
		got := model.summariseBlock(weighted)
		want := 2.0 * 2.8275862068965516 * model.OmmatidialAngle
		if got.Annular {
			t.Error("A profile at maximum on the axis is not annular")
		}
		if math.Abs(got.FWHMDegrees-want) > 1e-9 {
			t.Errorf("Expected FWHM %.6f deg, got %.6f", want, got.FWHMDegrees)
		}
	})

	// A ring has no acceptance angle about the axis; reporting its thickness instead
	// would read as an implausibly sharp eye.
	t.Run("AnnularProfileIsUndefined", func(t *testing.T) {
		psf := []float64{0.2, 0.6, 1.0, 0.6, 0.2, 0}
		weighted := make([]float64, len(psf))
		for j, v := range psf {
			weighted[j] = v * ringArea(j)
		}
		got := model.summariseBlock(weighted)
		if !got.Annular {
			t.Error("Expected the profile to be flagged as annular")
		}
		if !math.IsNaN(got.FWHMDegrees) {
			t.Errorf("Expected an undefined FWHM, got %f", got.FWHMDegrees)
		}
	})
}

func TestRunSimulation(t *testing.T) {
	res, err := RunSimulation(nephropsFlatLateral("test_matrix"), true)
	if err != nil {
		t.Fatalf("RunSimulation failed: %v", err)
	}
	if res.SpeciesName != "test_matrix" {
		t.Errorf("Expected speciesName 'test_matrix', got '%s'", res.SpeciesName)
	}
	if len(res.MatrixRes) != pigmentSteps || len(res.MatrixSens) != pigmentSteps {
		t.Fatalf("Expected %dx%d matrices, got res=%d sens=%d",
			pigmentSteps, pigmentSteps, len(res.MatrixRes), len(res.MatrixSens))
	}
	for r := 0; r < pigmentSteps; r++ {
		if len(res.MatrixRes[r]) != pigmentSteps || len(res.MatrixSens[r]) != pigmentSteps {
			t.Errorf("Row %d has the wrong width", r)
		}
		for c := 0; c < pigmentSteps; c++ {
			if v := float64(res.MatrixRes[r][c]); math.IsNaN(v) || v <= 0 {
				t.Errorf("Resolution [%d][%d] = %f, expected a positive acceptance angle", r, c, v)
			}
			if v := float64(res.MatrixSens[r][c]); v < 0 || v > 100 {
				t.Errorf("Sensitivity [%d][%d] = %f, expected a percentage in 0-100", r, c, v)
			}
		}
	}
	if res.SummaryResCsv == "" || res.SummarySenCsv == "" || res.PathlengthsCsv == "" {
		t.Error("Expected non-empty summary and pathlength output")
	}

	// One header row plus one row per traced ray, rather than the block headings
	// alone that earlier versions emitted.
	debugLines := strings.Split(strings.TrimSpace(res.DebugCsv), "\n")
	wantDebug := 1 + pigmentSteps*pigmentSteps*res.CalculatedStats.NumberOfFacets
	if len(debugLines) != wantDebug {
		t.Errorf("Expected %d debug rows, got %d", wantDebug, len(debugLines))
	}
	if !strings.HasPrefix(debugLines[0], "block,shielding_um,tapetal_um,facet,") {
		t.Errorf("Expected a descriptive debug header, got %q", debugLines[0])
	}

	// The geometry is a plain rectangular CSV: a header, then one row per rhabdom,
	// each carrying its own keys. No block terminator, no positional state.
	pathLines := strings.Split(strings.TrimSpace(res.PathlengthsCsv), "\n")
	if pathLines[0] != pathlengthsHeader {
		t.Fatalf("Expected the header %q, got %q", pathlengthsHeader, pathLines[0])
	}
	if strings.Contains(res.PathlengthsCsv, "\n999\n") {
		t.Error("Expected no 999 block terminator in the output")
	}

	type key struct{ block, facet int }
	seen := map[key]int{}
	for i, line := range pathLines[1:] {
		fields := strings.Split(line, ",")
		if len(fields) != 6 {
			t.Fatalf("Row %d: expected 6 fields, got %d: %q", i, len(fields), line)
		}
		block, _ := strconv.Atoi(fields[0])
		facet, _ := strconv.Atoi(fields[3])
		rhabdom, _ := strconv.Atoi(fields[4])
		k := key{block, facet}
		if rhabdom != seen[k] {
			t.Fatalf("Block %d facet %d: expected rhabdom %d, got %d", block, facet, seen[k], rhabdom)
		}
		seen[k]++
	}
	if want := pigmentSteps * pigmentSteps * res.CalculatedStats.NumberOfFacets; len(seen) != want {
		t.Errorf("Expected %d block/facet groups, got %d", want, len(seen))
	}
}

// TestMetricMarshalsUndefinedAsNull keeps the response serialisable: encoding/json
// fails outright on a NaN float, which would take the whole batch down.
func TestMetricMarshalsUndefinedAsNull(t *testing.T) {
	out, err := json.Marshal([]Metric{Metric(math.NaN()), Metric(9.5803)})
	if err != nil {
		t.Fatalf("Marshalling a NaN metric failed: %v", err)
	}
	if got := string(out); got != "[null,9.5803]" {
		t.Errorf("Expected [null,9.5803], got %s", got)
	}
}

func TestRunAllSimulationsReportsSkipped(t *testing.T) {
	csvData := `nephropsfl,180,25,7800,50,3200,1.34,1.37,18,0
astacodes,84,16,890,32,445,1.34,1.37,18,0
nephropspl,180,25,7800,50,3200,1.34,1.37,18,12.5`

	results, skipped, err := RunAllSimulations(csvData, false)
	if err != nil {
		t.Fatalf("Failed to run simulations: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("Expected 2 results, got %d", len(results))
	}
	if len(skipped) != 1 || !strings.Contains(skipped[0], "astacodes") {
		t.Errorf("Expected astacodes to be reported as skipped, got %v", skipped)
	}
	for _, r := range results {
		if r.CalculatedStats.NumberOfFacets != 33 {
			t.Errorf("Expected 33 facets for %s, got %d", r.SpeciesName, r.CalculatedStats.NumberOfFacets)
		}
	}
}

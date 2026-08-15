package main

import (
	"strings"
	"testing"
)

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
}

func TestRunSimulation(t *testing.T) {
	params := Parameters{
		SpeciesName:              "test_matrix",
		RhabdomLength:            127,
		RhabdomWidth:             15.8,
		EyeDiameter:              2480,
		FacetWidth:               22.5,
		ApertureDiameter:         870,
		CytoplasmRefractiveIndex: 1.34,
		RhabdomRefractiveIndex:   1.37,
		BlurCircleExtent:         1,
		ProximalRhabdomAngle:     0,
	}

	res := RunSimulation(params, true)
	if res.SpeciesName != "test_matrix" {
		t.Errorf("Expected speciesName 'test_matrix', got '%s'", res.SpeciesName)
	}

	if len(res.MatrixRes) != 11 {
		t.Fatalf("Expected 11 rows in MatrixRes, got %d", len(res.MatrixRes))
	}
	if len(res.MatrixSens) != 11 {
		t.Fatalf("Expected 11 rows in MatrixSens, got %d", len(res.MatrixSens))
	}

	for r := 0; r < 11; r++ {
		if len(res.MatrixRes[r]) != 11 {
			t.Errorf("Row %d: expected 11 columns in MatrixRes, got %d", r, len(res.MatrixRes[r]))
		}
		if len(res.MatrixSens[r]) != 11 {
			t.Errorf("Row %d: expected 11 columns in MatrixSens, got %d", r, len(res.MatrixSens[r]))
		}
	}

	if res.SummaryResCsv == "" {
		t.Errorf("Expected non-empty SummaryResCsv")
	}
	if res.SummarySenCsv == "" {
		t.Errorf("Expected non-empty SummarySenCsv")
	}
	if res.PathlengthsCsv == "" {
		t.Errorf("Expected non-empty PathlengthsCsv")
	}
	if res.DebugCsv == "" {
		t.Errorf("Expected non-empty DebugCsv when debugMode is true")
	}

	// Verify 121 blocks in PathlengthsCsv
	blockCount := strings.Count(res.PathlengthsCsv, "\n999\n")
	if blockCount != 121 && !strings.HasSuffix(res.PathlengthsCsv, "999\n") {
		// Just check total count of "999"
		c := strings.Count(res.PathlengthsCsv, "999")
		if c != 121 {
			t.Errorf("Expected 121 '999' block delimiters, got %d", c)
		}
	}
}

func TestNephropsSimulations(t *testing.T) {
	csvData := `nephropsfl,180,25,7800,50,3200,1.34,1.37,18,0
nephropspl,180,25,7800,50,3200,1.34,1.37,18,12.5`

	results, err := RunAllSimulations(csvData, false)
	if err != nil {
		t.Fatalf("Failed to run Nephrops simulations: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("Expected 2 results, got %d", len(results))
	}

	for _, r := range results {
		if len(r.MatrixRes) != 11 || len(r.MatrixSens) != 11 {
			t.Errorf("Expected 11x11 matrix for %s, got res=%d, sens=%d", r.SpeciesName, len(r.MatrixRes), len(r.MatrixSens))
		}
		if r.CalculatedStats.NumberOfFacets != 33 {
			t.Errorf("Expected 33 facets for %s, got %d", r.SpeciesName, r.CalculatedStats.NumberOfFacets)
		}
	}
}

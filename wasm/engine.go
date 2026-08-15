package main

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"math"
	"strconv"
	"strings"
)

var degToRadConv = math.Pi / 180.0
var radToDegConv = 180.0 / math.Pi

// Parameters holds all the eye-specific configuration.
type Parameters struct {
	SpeciesName              string  `json:"speciesName"`
	RhabdomLength            float64 `json:"rhabdomLength"`
	RhabdomWidth             float64 `json:"rhabdomWidth"`
	EyeDiameter              float64 `json:"eyeDiameter"`
	FacetWidth               float64 `json:"facetWidth"`
	ApertureDiameter         float64 `json:"apertureDiameter"`
	CytoplasmRefractiveIndex float64 `json:"cytoplasmRefractiveIndex"`
	RhabdomRefractiveIndex   float64 `json:"rhabdomRefractiveIndex"`
	BlurCircleExtent         float64 `json:"blurCircleExtent"`
	ProximalRhabdomAngle     float64 `json:"proximalRhabdomAngle"`
}

// CalculatedStats holds derived optical constants and geometry metrics.
type CalculatedStats struct {
	CircumferenceOfEye float64 `json:"circumferenceOfEye"`
	ApertureRadius     float64 `json:"apertureRadius"`
	EyeRadius          float64 `json:"eyeRadius"`
	DistanceToAperture float64 `json:"distanceToAperture"`
	AngleAtCenter      float64 `json:"angleAtCenter"`
	ApertureArc        float64 `json:"apertureArc"`
	OmmatidialAngle    float64 `json:"ommatidialAngle"`
	NumberOfFacets     int     `json:"numberOfFacets"`
	RhabdomRadius      float64 `json:"rhabdomRadius"`
	CriticalAngle      float64 `json:"criticalAngle"`
}

// SimulationResult holds the full output for a single species simulation run.
type SimulationResult struct {
	SpeciesName     string          `json:"speciesName"`
	Params          Parameters      `json:"params"`
	CalculatedStats CalculatedStats `json:"calculatedStats"`
	SummaryResCsv   string          `json:"summaryResCsv"`
	SummarySenCsv   string          `json:"summarySenCsv"`
	PathlengthsCsv  string          `json:"pathlengthsCsv"`
	DebugCsv        string          `json:"debugCsv"`
	MatrixRes       [][]int         `json:"matrixRes"`
	MatrixSens      [][]int         `json:"matrixSens"`
}

// Model holds the calculated parameters and state of the simulation.
type Model struct {
	Params                   Parameters
	TapetalPigment           float64
	ShieldingPigment         float64
	CircumferenceOfEye       float64
	ApertureRadius           float64
	EyeRadius                float64
	DistanceToAperture       float64
	AngleAtCenter            float64
	ApertureArc              float64
	OmmatidialAngle          float64
	NumberOfFacets           int
	RhabdomRadius            float64
	IncidenceOmmatidialAngle float64
	CriticalAngle            float64
	RefractedOmmatidialAngle float64
	OldRhabdomLength         float64
	DebugMode                bool
}

// NewModel initialises a model with a given set of parameters.
func NewModel(params Parameters) *Model {
	m := &Model{Params: params}
	m.initialCalculations()
	return m
}

// initialCalculations sets up the initial state of the model based on parameters.
func (m *Model) initialCalculations() {
	p := m.Params
	m.OldRhabdomLength = p.RhabdomLength
	m.CircumferenceOfEye = math.Pi * p.EyeDiameter
	m.ApertureRadius = p.ApertureDiameter / 2.0
	m.EyeRadius = p.EyeDiameter / 2.0
	m.DistanceToAperture = math.Sqrt(math.Pow(m.EyeRadius, 2) - math.Pow(m.ApertureRadius, 2))
	m.AngleAtCenter = math.Atan(m.ApertureRadius/m.DistanceToAperture) / degToRadConv
	m.ApertureArc = (m.AngleAtCenter / 360.0) * m.CircumferenceOfEye
	m.OmmatidialAngle = (p.FacetWidth / m.CircumferenceOfEye) * 360.0
	m.RhabdomRadius = p.RhabdomWidth / 2.0

	// Number of facets in eyeshine patch axis
	m.NumberOfFacets = int(math.Round(m.ApertureArc / p.FacetWidth))

	// Angle of total internal reflection
	snellsLaw := math.Asin(p.CytoplasmRefractiveIndex / p.RhabdomRefractiveIndex)
	m.CriticalAngle = 90.0 - (snellsLaw / degToRadConv)

	// Reset angles
	m.IncidenceOmmatidialAngle = 0.0
	m.RefractedOmmatidialAngle = 0.0
}

// runModelInMemory executes ray tracing in memory and returns pathlengths CSV and debug CSV.
func (m *Model) runModelInMemory() (pathlengthsCsv string, debugCsv string) {
	p := m.Params
	var pathlengthsBuf strings.Builder
	var debugBuf strings.Builder

	incrementAmount := p.RhabdomLength / 10.0

	// Main pigment loops (11 steps for Shielding pigment, 11 steps for Tapetal pigment)
	for pStep := 0; pStep <= 10; pStep++ {
		m.ShieldingPigment = float64(pStep) * incrementAmount
		for tStep := 0; tStep <= 10; tStep++ {
			m.TapetalPigment = float64(tStep) * incrementAmount

			fmt.Fprintf(&pathlengthsBuf, "%.6f\n%.6f\n", m.ShieldingPigment, m.TapetalPigment)
			if m.DebugMode {
				fmt.Fprintf(&debugBuf, "P: %.2f, T: %.2f\n", m.ShieldingPigment, m.TapetalPigment)
			}

			// Loop over each facet across the eyeshine patch axis
			for currentFacet := 0; currentFacet < m.NumberOfFacets; currentFacet++ {
				m.IncidenceOmmatidialAngle = float64(currentFacet) * m.OmmatidialAngle

				// Account for refraction at the cornea
				switch {
				case m.IncidenceOmmatidialAngle == 0:
					m.RefractedOmmatidialAngle = 0.0
				case m.IncidenceOmmatidialAngle > 0 && m.IncidenceOmmatidialAngle <= 15:
					m.RefractedOmmatidialAngle = (m.IncidenceOmmatidialAngle * 0.9494) + 0.004667
				case m.IncidenceOmmatidialAngle > 15 && m.IncidenceOmmatidialAngle <= 35:
					m.RefractedOmmatidialAngle = (m.IncidenceOmmatidialAngle * 0.9407) + 0.1648
				case m.IncidenceOmmatidialAngle > 35 && m.IncidenceOmmatidialAngle <= 50:
					m.RefractedOmmatidialAngle = (m.IncidenceOmmatidialAngle * 0.9196) + 0.8676
				case m.IncidenceOmmatidialAngle > 50 && m.IncidenceOmmatidialAngle <= 60:
					m.RefractedOmmatidialAngle = (m.IncidenceOmmatidialAngle * 0.8677) + 3.38
				case m.IncidenceOmmatidialAngle > 60:
					m.RefractedOmmatidialAngle = 60.0
				}

				// Light loss at cone due to angle of incidence
				var facetNum float64
				if m.RefractedOmmatidialAngle == 0 {
					facetNum = 1.0
				} else {
					cc := p.FacetWidth / math.Abs(math.Tan(m.RefractedOmmatidialAngle*degToRadConv))
					var fw float64
					if cc > p.FacetWidth*2.0 {
						fw = math.Cos(m.IncidenceOmmatidialAngle*degToRadConv) * p.FacetWidth
					} else {
						ll := (2.0 * cc) - (2.0 * p.FacetWidth)
						fw = math.Sin(m.IncidenceOmmatidialAngle*degToRadConv) * ll
					}
					facetNum = fw / p.FacetWidth
				}
				if facetNum > 1.0 {
					facetNum = 1.0
				}
				if facetNum < 0.0 {
					facetNum = 0.0
				}

				// Leading zeros for blur circle off-axis shift and angle adjustment
				var rowData []string
				boa := m.RefractedOmmatidialAngle
				if p.BlurCircleExtent > 0 {
					fd := float64(m.NumberOfFacets) / p.BlurCircleExtent
					for i := 1; i <= int(p.BlurCircleExtent); i++ {
						if float64(currentFacet) > (fd * float64(i)) {
							boa += m.OmmatidialAngle
							rowData = append(rowData, "0")
						}
					}
				}

				// Ray tracing through rhabdom array
				rhabdomLength := m.OldRhabdomLength
				cz := 0
				for {
					// Account for tapered/pointy rhabdom shape at proximal entrance
					if boa > m.CriticalAngle && cz == 0 {
						boa -= p.ProximalRhabdomAngle
					}

					if m.IncidenceOmmatidialAngle == 0 {
						// CASE 4: Perpendicular ray
						var val float64
						if m.TapetalPigment == 0 || m.ShieldingPigment > 0 {
							val = rhabdomLength * facetNum
						} else {
							val = (rhabdomLength * 2.0) * facetNum
						}
						rowData = append(rowData, fmt.Sprintf("%.6f", val))
						break
					}

					y := m.RhabdomRadius / math.Abs(math.Tan(boa*degToRadConv))

					if y >= rhabdomLength {
						// CASE 3: Bounce off base
						var x, v, val float64
						mx := math.Sqrt(math.Pow(rhabdomLength, 2) + math.Pow(m.RhabdomRadius, 2))
						if y == rhabdomLength {
							x = mx
						} else {
							x = rhabdomLength / math.Abs(math.Cos(boa*degToRadConv))
						}
						if x > m.OldRhabdomLength {
							v = x
						} else {
							v = m.OldRhabdomLength
						}

						if m.TapetalPigment == 0 || m.ShieldingPigment > 0 {
							val = x * facetNum
						} else {
							val = (x + v) * facetNum
						}
						rowData = append(rowData, fmt.Sprintf("%.6f", val))
						break
					} else if y > (rhabdomLength-m.ShieldingPigment) || y > (rhabdomLength-m.TapetalPigment) || boa < m.CriticalAngle {
						// CASE 2: Reflection from edge
						var val float64
						x := m.RhabdomRadius / math.Abs(math.Sin(boa*degToRadConv))
						z := (rhabdomLength - y) / math.Abs(math.Cos(boa*degToRadConv))
						if z > x {
							z = x
						}
						var v float64
						if (x + z) > m.OldRhabdomLength {
							v = x + z
						} else {
							v = m.OldRhabdomLength
						}
						if m.TapetalPigment == 0 {
							val = (x + z) * facetNum
						} else {
							val = (x + z + v) * facetNum
						}
						if m.ShieldingPigment > 0 {
							val = (x + z) * facetNum
						}
						if m.ShieldingPigment > (rhabdomLength - y) {
							val = x * facetNum
						}
						rowData = append(rowData, fmt.Sprintf("%.6f", val))
						break
					} else {
						// CASE 1: No reflection (ray passes through rhabdom wall into adjacent rhabdom)
						x := m.RhabdomRadius / math.Abs(math.Sin(boa*degToRadConv))
						rowData = append(rowData, fmt.Sprintf("%.6f", x*facetNum))
						rhabdomLength -= y
						boa += m.OmmatidialAngle
						cz = 1
						if rhabdomLength <= m.TapetalPigment || rhabdomLength <= m.ShieldingPigment {
							break
						}
					}
				}

				// Write row
				fmt.Fprintln(&pathlengthsBuf, strings.Join(rowData, ","))
			}

			fmt.Fprintln(&pathlengthsBuf, "999")
		}
	}

	return pathlengthsBuf.String(), debugBuf.String()
}

// calculateRessensInMemory calculates resolution and sensitivity matrices from the pathlengths string.
func (m *Model) calculateRessensInMemory(pathlengthsContent string) (resCsv string, senCsv string, matrixRes [][]int, matrixSens [][]int) {
	var resBuf strings.Builder
	var sensBuf strings.Builder

	rhabdoms := make([]float64, 21)
	currentSensRow := []string{}
	currentResRow := []string{}
	currentSensInts := []int{}
	currentResInts := []int{}

	matrixSens = [][]int{}
	matrixRes = [][]int{}

	facet := 0.0
	arem := 0.0
	cc, dd := 0, 0
	headerCount := 0

	scanner := bufio.NewScanner(strings.NewReader(pathlengthsContent))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		if line == "999" {
			// End of block, summarize
			sens := 0.0
			for _, r := range rhabdoms {
				sens += r
			}
			halfwayPoint := rhabdoms[0] / 2.0
			opticAxis := 0.0
			xz, yy := rhabdoms[0], rhabdoms[1]

			for i := 1; i < 12; i++ {
				if halfwayPoint < rhabdoms[i] {
					xz = rhabdoms[i]
					if i+1 < len(rhabdoms) {
						yy = rhabdoms[i+1]
					}
					opticAxis = m.OmmatidialAngle * float64(i)
				}
			}
			diff := xz - yy
			hwp := xz - halfwayPoint
			var frac float64
			if diff > 0 && hwp >= 0 {
				frac = math.Min(1.0, math.Max(0.0, hwp/(diff+0.1)))
			} else {
				frac = 0.0
			}
			oab := frac * m.OmmatidialAngle
			res := oab + opticAxis
			if res < 0 {
				res = 0.0
			}

			if cc == 0 && dd > 0 {
				fmt.Fprintln(&sensBuf, strings.Join(currentSensRow, ","))
				fmt.Fprintln(&resBuf, strings.Join(currentResRow, ","))
				matrixSens = append(matrixSens, currentSensInts)
				matrixRes = append(matrixRes, currentResInts)
				currentSensRow = []string{}
				currentResRow = []string{}
				currentSensInts = []int{}
				currentResInts = []int{}
			}

			sensVal := 0
			if arem > 0 {
				sensVal = int(sens / arem)
			}
			resVal := int(res * 200.0)

			currentSensRow = append(currentSensRow, fmt.Sprintf("%d", sensVal))
			currentResRow = append(currentResRow, fmt.Sprintf("%d", resVal))
			currentSensInts = append(currentSensInts, sensVal)
			currentResInts = append(currentResInts, resVal)

			cc++
			if cc == 11 {
				dd++
				cc = 0
			}
			// Reset for next block
			rhabdoms = make([]float64, 21)
			facet = 0
			headerCount = 0
		} else if headerCount < 2 {
			// Shielding or Tapetal pigment header line
			headerCount++
		} else {
			// Facet pathlength row
			parts := strings.Split(line, ",")
			rhabdom := 0
			tot := 0.0
			area := math.Pi * math.Pow(facet+0.5, 2)
			inci := math.Pi * math.Pow(facet-0.5, 2)
			if facet == 0 {
				inci = 0
			}
			torus := area - inci
			if area > arem {
				arem = area
			}

			for _, part := range parts {
				pathlength, _ := strconv.ParseFloat(part, 64)
				var absorbance, bx float64
				if pathlength > 0 {
					absorbance = 1 - math.Exp(-0.01*pathlength)
				} else {
					absorbance = 0
				}
				if rhabdom == 0 && absorbance > 0 {
					bx = 100 * absorbance
				} else if rhabdom > 0 && absorbance > 0 {
					bx = 100 * ((1 - tot) * absorbance)
				}
				if absorbance == 0 {
					bx = 0
				}
				tot += bx / 100.0
				bx *= torus
				if rhabdom < len(rhabdoms) {
					rhabdoms[rhabdom] += bx
				}
				rhabdom++
			}
			facet++
		}
	}

	// Write the final line of data
	if len(currentSensRow) > 0 {
		fmt.Fprintln(&sensBuf, strings.Join(currentSensRow, ","))
		fmt.Fprintln(&resBuf, strings.Join(currentResRow, ","))
		matrixSens = append(matrixSens, currentSensInts)
		matrixRes = append(matrixRes, currentResInts)
	}

	return strings.TrimSpace(resBuf.String()), strings.TrimSpace(sensBuf.String()), matrixRes, matrixSens
}

// ParseInputParametersString parses a CSV string into a slice of Parameters.
func ParseInputParametersString(csvContent string) ([]Parameters, error) {
	var paramsList []Parameters

	reader := csv.NewReader(strings.NewReader(csvContent))
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if parseErr, ok := err.(*csv.ParseError); ok && parseErr.Err == csv.ErrFieldCount {
			log.Printf("Skipping malformed record on line %d: %v", parseErr.Line, err)
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("error reading CSV record: %w", err)
		}

		if len(record) != 10 {
			continue
		}

		// Clean genus/species name
		species := strings.ToLower(strings.TrimSpace(record[0]))
		if species == "" || species == "genus" || species == "species" {
			// Skip header if present
			continue
		}

		rl, _ := strconv.ParseFloat(strings.TrimSpace(record[1]), 64)
		rw, _ := strconv.ParseFloat(strings.TrimSpace(record[2]), 64)
		ed, _ := strconv.ParseFloat(strings.TrimSpace(record[3]), 64)
		fw, _ := strconv.ParseFloat(strings.TrimSpace(record[4]), 64)
		ad, _ := strconv.ParseFloat(strings.TrimSpace(record[5]), 64)
		cri, _ := strconv.ParseFloat(strings.TrimSpace(record[6]), 64)
		rri, _ := strconv.ParseFloat(strings.TrimSpace(record[7]), 64)
		bce, _ := strconv.ParseFloat(strings.TrimSpace(record[8]), 64)
		pra, _ := strconv.ParseFloat(strings.TrimSpace(record[9]), 64)

		params := Parameters{
			SpeciesName:              species,
			RhabdomLength:            rl,
			RhabdomWidth:             rw,
			EyeDiameter:              ed,
			FacetWidth:               fw,
			ApertureDiameter:         ad,
			CytoplasmRefractiveIndex: cri,
			RhabdomRefractiveIndex:   rri,
			BlurCircleExtent:         math.Max(1.0, bce),
			ProximalRhabdomAngle:     pra,
		}

		paramsList = append(paramsList, params)
	}

	if len(paramsList) == 0 {
		return nil, fmt.Errorf("no valid parameter rows found in input")
	}

	return paramsList, nil
}

// RunSimulation runs the simulation for a single parameter set in memory.
func RunSimulation(p Parameters, debugMode bool) *SimulationResult {
	model := NewModel(p)
	model.DebugMode = debugMode

	pathlengthsCsv, debugCsv := model.runModelInMemory()
	resCsv, senCsv, matrixRes, matrixSens := model.calculateRessensInMemory(pathlengthsCsv)

	stats := CalculatedStats{
		CircumferenceOfEye: model.CircumferenceOfEye,
		ApertureRadius:     model.ApertureRadius,
		EyeRadius:          model.EyeRadius,
		DistanceToAperture: model.DistanceToAperture,
		AngleAtCenter:      model.AngleAtCenter,
		ApertureArc:        model.ApertureArc,
		OmmatidialAngle:    model.OmmatidialAngle,
		NumberOfFacets:     model.NumberOfFacets,
		RhabdomRadius:      model.RhabdomRadius,
		CriticalAngle:      model.CriticalAngle,
	}

	return &SimulationResult{
		SpeciesName:     p.SpeciesName,
		Params:          p,
		CalculatedStats: stats,
		SummaryResCsv:   resCsv,
		SummarySenCsv:   senCsv,
		PathlengthsCsv:  pathlengthsCsv,
		DebugCsv:        debugCsv,
		MatrixRes:       matrixRes,
		MatrixSens:      matrixSens,
	}
}

// RunAllSimulations processes an input CSV and returns all simulation results.
func RunAllSimulations(csvContent string, debugMode bool) ([]*SimulationResult, error) {
	paramsList, err := ParseInputParametersString(csvContent)
	if err != nil {
		return nil, err
	}

	var results []*SimulationResult
	for _, p := range paramsList {
		res := RunSimulation(p, debugMode)
		results = append(results, res)
	}

	return results, nil
}

package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"math"
	"strconv"
	"strings"
)

const (
	degToRadConv = math.Pi / 180.0
	radToDegConv = 180.0 / math.Pi

	// pigmentSteps is the number of migration positions sampled for each pigment,
	// from fully retracted (0) to fully covering the rhabdom (RhabdomLength).
	pigmentSteps = 11

	// maxPropagationAngle is the largest angle to the rhabdom axis at which a ray
	// can still advance towards the proximal end. At or beyond 90 degrees the ray
	// travels perpendicular to (or back along) the axis and is treated as lost.
	maxPropagationAngle = 90.0

	// absorptionCoefficient is the rhabdom absorption coefficient in um^-1, used in
	// the Beer-Lambert absorbance 1 - exp(-k*L). Reported values for crustacean
	// rhabdoms span roughly 0.0067 to 0.01 um^-1.
	absorptionCoefficient = 0.01

	// pathlengthsHeader labels the columns of the raw geometry output. Every row
	// carries its own keys, so the file is a plain rectangular CSV with no positional
	// state and no block terminator.
	pathlengthsHeader = "block,shielding_um,tapetal_um,facet,rhabdom,pathlength_um"
)

// Metric is a summary value that may be undefined. Encoding NaN as null keeps the
// whole response serialisable, where encoding/json would otherwise fail outright.
type Metric float64

func (m Metric) MarshalJSON() ([]byte, error) {
	f := float64(m)
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return []byte("null"), nil
	}
	return []byte(strconv.FormatFloat(f, 'f', 4, 64)), nil
}

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
	// MatrixRes holds the FWHM of the point spread function in degrees, and
	// MatrixSens the percentage of incident light absorbed. Rows vary the shielding
	// (proximal screening) pigment, columns the tapetal (reflecting) pigment.
	MatrixRes  [][]Metric `json:"matrixRes"`
	MatrixSens [][]Metric `json:"matrixSens"`
	Warnings   []string   `json:"warnings,omitempty"`
}

// Model holds the derived optics of the simulation.
type Model struct {
	Params             Parameters
	CircumferenceOfEye float64
	ApertureRadius     float64
	EyeRadius          float64
	DistanceToAperture float64
	AngleAtCenter      float64
	ApertureArc        float64
	OmmatidialAngle    float64
	NumberOfFacets     int
	RhabdomRadius      float64
	CriticalAngle      float64
	DebugMode          bool
}

// NewModel initialises a model with a given set of parameters. It returns an error
// if the parameters do not describe a physically realisable eye, rather than allowing
// NaNs to propagate silently into the results.
func NewModel(params Parameters) (*Model, error) {
	if err := validateParameters(params); err != nil {
		return nil, err
	}
	m := &Model{Params: params}
	m.initialCalculations()
	if err := m.validateGeometry(); err != nil {
		return nil, err
	}
	return m, nil
}

// validateParameters rejects inputs that would produce NaNs or nonsensical optics.
func validateParameters(p Parameters) error {
	if strings.TrimSpace(p.SpeciesName) == "" {
		return fmt.Errorf("species name is required")
	}
	for _, c := range []struct {
		name string
		v    float64
	}{
		{"rhabdom length", p.RhabdomLength},
		{"rhabdom width", p.RhabdomWidth},
		{"eye diameter", p.EyeDiameter},
		{"facet width", p.FacetWidth},
		{"aperture diameter", p.ApertureDiameter},
	} {
		if !(c.v > 0) {
			return fmt.Errorf("%s must be greater than 0 um, got %g", c.name, c.v)
		}
	}
	if p.ApertureDiameter >= p.EyeDiameter {
		return fmt.Errorf("aperture diameter (%g um) must be smaller than eye diameter (%g um)",
			p.ApertureDiameter, p.EyeDiameter)
	}
	if p.CytoplasmRefractiveIndex <= 1.0 {
		return fmt.Errorf("cytoplasm refractive index must be greater than 1.0, got %g",
			p.CytoplasmRefractiveIndex)
	}
	// Without n_rhabdom > n_cytoplasm there is no waveguiding and no critical angle:
	// asin(n_cyt/n_rhab) would be NaN and every total-internal-reflection test would
	// silently evaluate to false.
	if p.RhabdomRefractiveIndex <= p.CytoplasmRefractiveIndex {
		return fmt.Errorf("rhabdom refractive index (%g) must exceed cytoplasm refractive index (%g) for total internal reflection",
			p.RhabdomRefractiveIndex, p.CytoplasmRefractiveIndex)
	}
	if p.BlurCircleExtent < 1 {
		return fmt.Errorf("blur circle extent must be at least 1 rhabdom, got %g", p.BlurCircleExtent)
	}
	if p.ProximalRhabdomAngle < 0 {
		return fmt.Errorf("proximal rhabdom angle must not be negative, got %g", p.ProximalRhabdomAngle)
	}
	return nil
}

// validateGeometry checks the values derived from the parameters.
func (m *Model) validateGeometry() error {
	if m.NumberOfFacets < 1 {
		return fmt.Errorf("eyeshine patch spans no facets (aperture arc %.2f um / facet width %.2f um); "+
			"check aperture and facet dimensions", m.ApertureArc, m.Params.FacetWidth)
	}
	// The blur circle spreads the light gathered across the eyeshine patch over
	// BlurCircleExtent rhabdoms. With more blur steps than facets, the mapping from
	// facet to rhabdom offset leaves offsets with no contributing facet at all,
	// producing a comb-shaped profile whose half maximum is a binning artefact.
	if m.Params.BlurCircleExtent > float64(m.NumberOfFacets) {
		return fmt.Errorf("blur circle extent (%g rhabdoms) exceeds the %d facets across the eyeshine patch; "+
			"the resulting profile would contain rhabdom offsets that receive no light",
			m.Params.BlurCircleExtent, m.NumberOfFacets)
	}
	return nil
}

// initialCalculations sets up the derived optical values of the model.
func (m *Model) initialCalculations() {
	p := m.Params
	m.CircumferenceOfEye = math.Pi * p.EyeDiameter
	m.ApertureRadius = p.ApertureDiameter / 2.0
	m.EyeRadius = p.EyeDiameter / 2.0
	m.DistanceToAperture = math.Sqrt(math.Pow(m.EyeRadius, 2) - math.Pow(m.ApertureRadius, 2))
	m.AngleAtCenter = math.Atan(m.ApertureRadius/m.DistanceToAperture) * radToDegConv
	m.ApertureArc = (m.AngleAtCenter / 360.0) * m.CircumferenceOfEye
	m.OmmatidialAngle = (p.FacetWidth / m.CircumferenceOfEye) * 360.0
	m.RhabdomRadius = p.RhabdomWidth / 2.0

	// Number of facets along the radius of the eyeshine patch.
	m.NumberOfFacets = int(math.Round(m.ApertureArc / p.FacetWidth))

	// boa is measured from the rhabdom axis, so the angle at the wall normal is
	// (90 - boa) and light is guided when (90 - boa) exceeds the Snell critical
	// angle, i.e. when boa < CriticalAngle.
	snellsLaw := math.Asin(p.CytoplasmRefractiveIndex/p.RhabdomRefractiveIndex) * radToDegConv
	m.CriticalAngle = 90.0 - snellsLaw
}

// refractedAngle applies the empirical corneal refraction regression to an angle of
// incidence, in degrees.
func refractedAngle(incidence float64) float64 {
	switch {
	case incidence <= 0:
		return 0.0
	case incidence <= 15:
		return (incidence * 0.9494) + 0.004667
	case incidence <= 35:
		return (incidence * 0.9407) + 0.1648
	case incidence <= 50:
		return (incidence * 0.9196) + 0.8676
	case incidence <= 60:
		return (incidence * 0.8677) + 3.38
	default:
		return math.NaN()
	}
}

// facetTransmission is the fraction of light a facet admits at the given angle of
// incidence, relative to a facet viewed normally. It is a flux factor in [0, 1] and
// is applied to the absorbed intensity, not to the geometric path length.
func (m *Model) facetTransmission(facetIndex int) float64 {
	incidence := float64(facetIndex) * m.OmmatidialAngle
	refracted := refractedAngle(incidence)
	if math.IsNaN(refracted) {
		return 0.0
	}
	if refracted == 0 {
		return 1.0
	}
	cc := m.Params.FacetWidth / math.Abs(math.Tan(refracted*degToRadConv))
	var fw float64
	if cc > m.Params.FacetWidth*2.0 {
		fw = math.Cos(incidence*degToRadConv) * m.Params.FacetWidth
	} else {
		ll := (2.0 * cc) - (2.0 * m.Params.FacetWidth)
		fw = math.Sin(incidence*degToRadConv) * ll
	}
	return math.Min(1.0, math.Max(0.0, fw/m.Params.FacetWidth))
}

// blurOffset is the displacement, in rhabdoms, of the image formed by the facet at
// the given radial position in the eyeshine patch.
//
// The blur circle spans BlurCircleExtent rhabdoms, so the outermost facet is
// displaced by (BlurCircleExtent - 1) and the central facet by zero. The offset is
// continuous in the facet index: quantising it to whole rhabdoms (as earlier versions
// did, via a chain of `facet > fd*i` tests) aliased the facets unevenly across the
// available offsets and cut notches into the profile at offsets where fd*i landed on
// an exact integer.
func (m *Model) blurOffset(facetIndex int) float64 {
	if m.NumberOfFacets <= 1 {
		return 0.0
	}
	return float64(facetIndex) * (m.Params.BlurCircleExtent - 1.0) / float64(m.NumberOfFacets-1)
}

// traceResult is the outcome of tracing one ray through the rhabdom array.
type traceResult struct {
	// Pathlengths through each successive rhabdom the ray enters, in micrometres of
	// raw geometry. Facet transmission is NOT folded in here; it is a flux factor
	// applied when the absorbed intensity is computed.
	Pathlengths []float64
	// TerminalCase records which branch ended the trace, for the debug output.
	TerminalCase string
	// MaxAngle is the largest angle to the rhabdom axis reached during the trace.
	MaxAngle float64
	// Lost is set when the ray stopped propagating towards the proximal end.
	Lost bool
}

// traceRay follows a single ray from the given facet through the rhabdom array for
// one combination of pigment positions.
func (m *Model) traceRay(facetIndex int, shielding, tapetal float64) traceResult {
	p := m.Params
	res := traceResult{}

	// Angle to the rhabdom axis on entry: corneal refraction plus the blur-circle
	// displacement, which tilts the ray by one ommatidial angle per rhabdom offset.
	boa := refractedAngle(float64(facetIndex)*m.OmmatidialAngle) + m.blurOffset(facetIndex)*m.OmmatidialAngle

	rhabdomLength := p.RhabdomLength
	cz := 0

	for {
		// Tapered ("pointy") rhabdom tip widens the acceptance angle on first entry.
		if boa > m.CriticalAngle && cz == 0 {
			boa -= p.ProximalRhabdomAngle
			if boa < 0 {
				boa = 0
			}
		}

		// A ray at 90 degrees or more to the axis cannot advance towards the proximal
		// end. Earlier versions took the absolute value of tan and cos, which silently
		// folded such rays back and produced path lengths many times the rhabdom length.
		if boa >= maxPropagationAngle || math.IsNaN(boa) {
			res.TerminalCase = "lost"
			res.Lost = true
			return res
		}
		if boa > res.MaxAngle {
			res.MaxAngle = boa
		}

		if facetIndex == 0 {
			// CASE 4: axial ray. Equivalent to case 3 at boa = 0, kept explicit.
			val := rhabdomLength
			if tapetal > 0 && shielding == 0 {
				val = rhabdomLength * 2.0
			}
			res.Pathlengths = append(res.Pathlengths, val)
			res.TerminalCase = "C4"
			return res
		}

		sin := math.Sin(boa * degToRadConv)
		cos := math.Cos(boa * degToRadConv)
		tan := math.Tan(boa * degToRadConv)

		// Axial distance travelled before the ray meets the rhabdom wall.
		y := m.RhabdomRadius / tan

		switch {
		case y >= rhabdomLength:
			// CASE 3: the ray reaches the base without meeting the wall and is
			// reflected by the tapetum at the base.
			x := rhabdomLength / cos
			v := p.RhabdomLength / cos
			val := x
			if tapetal > 0 && shielding == 0 {
				val = x + v
			}
			res.Pathlengths = append(res.Pathlengths, val)
			res.TerminalCase = "C3"
			return res

		case y > (rhabdomLength-shielding) || y > (rhabdomLength-tapetal) || boa < m.CriticalAngle:
			// CASE 2: the ray is reflected at the wall, either by total internal
			// reflection or by the tapetal mirror.
			x := m.RhabdomRadius / sin

			// A guided ray never leaves the rhabdom, so the proximal screening pigment
			// - which lies in the cytoplasm outside the rhabdom - cannot absorb it.
			// An unguided ray exits through the wall and is absorbed where the pigment
			// starts.
			guided := boa < m.CriticalAngle
			axial := rhabdomLength - y
			if shielding > 0 && !guided {
				axial = math.Max(0, rhabdomLength-shielding-y)
			}
			z := axial / cos
			v := p.RhabdomLength / cos

			val := x + z
			if tapetal > 0 && shielding == 0 {
				val = x + z + v
			}
			res.Pathlengths = append(res.Pathlengths, val)
			res.TerminalCase = "C2"
			return res

		default:
			// CASE 1: no reflection. The ray crosses the wall into the adjacent
			// rhabdom, and the inter-rhabdom angle steps by one ommatidial angle.
			res.Pathlengths = append(res.Pathlengths, m.RhabdomRadius/sin)
			rhabdomLength -= y
			boa += m.OmmatidialAngle
			cz = 1
			if rhabdomLength <= tapetal || rhabdomLength <= shielding {
				res.TerminalCase = "C1"
				return res
			}
		}
	}
}

// runModelInMemory executes ray tracing and returns the raw pathlength geometry, the
// debug trace, the per-state summaries, and the number of rays that stopped
// propagating.
//
// The absorption profile is accumulated as the rays are traced rather than by parsing
// the geometry back, so the summary does not depend on the output format at all.
func (m *Model) runModelInMemory() (pathlengthsCsv string, debugCsv string, summaries []blockSummary, lostRays int) {
	p := m.Params
	var pathlengthsBuf strings.Builder
	var debugBuf strings.Builder

	fmt.Fprintln(&pathlengthsBuf, pathlengthsHeader)

	if m.DebugMode {
		fmt.Fprintln(&debugBuf,
			"block,shielding_um,tapetal_um,facet,incidence_deg,refracted_deg,blur_offset_rhabdoms,entry_boa_deg,facet_transmission,terminal_case,rhabdoms_entered,pathlengths_um")
	}

	incrementAmount := p.RhabdomLength / 10.0
	block := 0
	summaries = make([]blockSummary, 0, pigmentSteps*pigmentSteps)

	for pStep := 0; pStep < pigmentSteps; pStep++ {
		shielding := float64(pStep) * incrementAmount
		for tStep := 0; tStep < pigmentSteps; tStep++ {
			tapetal := float64(tStep) * incrementAmount

			// Area-weighted absorbed light at each rhabdom offset from the optic axis.
			var profile []float64

			for facet := 0; facet < m.NumberOfFacets; facet++ {
				trace := m.traceRay(facet, shielding, tapetal)
				if trace.Lost {
					lostRays++
				}
				profile = m.accumulate(profile, facet, trace.Pathlengths)

				if len(trace.Pathlengths) == 0 {
					// A lost ray absorbs nothing, but the facet still belongs in the
					// record, so emit an explicit zero for it.
					fmt.Fprintf(&pathlengthsBuf, "%d,%.6f,%.6f,%d,0,0.000000\n",
						block, shielding, tapetal, facet)
				}
				for rhabdom, v := range trace.Pathlengths {
					fmt.Fprintf(&pathlengthsBuf, "%d,%.6f,%.6f,%d,%d,%.6f\n",
						block, shielding, tapetal, facet, rhabdom, v)
				}

				if m.DebugMode {
					parts := make([]string, len(trace.Pathlengths))
					for i, v := range trace.Pathlengths {
						parts[i] = fmt.Sprintf("%.6f", v)
					}
					incidence := float64(facet) * m.OmmatidialAngle
					fmt.Fprintf(&debugBuf, "%d,%.4f,%.4f,%d,%.4f,%.4f,%.4f,%.4f,%.6f,%s,%d,%s\n",
						block, shielding, tapetal, facet, incidence, refractedAngle(incidence),
						m.blurOffset(facet),
						refractedAngle(incidence)+m.blurOffset(facet)*m.OmmatidialAngle,
						m.facetTransmission(facet), trace.TerminalCase,
						len(trace.Pathlengths), strings.Join(parts, " "))
				}
			}

			summaries = append(summaries, m.summariseBlock(profile))
			block++
		}
	}

	return strings.TrimSpace(pathlengthsBuf.String()), strings.TrimSpace(debugBuf.String()), summaries, lostRays
}

// accumulate adds one facet's traced ray into the area-weighted absorption profile,
// which records how much light reaches each whole-rhabdom offset from the optic axis.
func (m *Model) accumulate(profile []float64, facetIndex int, pathlengths []float64) []float64 {
	// Light gathered by this facet, and the rhabdom offset its image lands on.
	transmission := m.facetTransmission(facetIndex)
	sourceArea := ringArea(facetIndex)
	offset := m.blurOffset(facetIndex)
	base := int(math.Floor(offset))
	frac := offset - float64(base)

	tot := 0.0
	for rhabdom, pathlength := range pathlengths {
		if pathlength <= 0 {
			continue
		}
		// Fraction of the light still travelling that this rhabdom absorbs.
		absorbed := (1.0 - tot) * (1.0 - math.Exp(-absorptionCoefficient*pathlength))
		tot += absorbed
		// Facet transmission attenuates the flux entering the eye; it does not shorten
		// the geometric path, so it multiplies the absorbed intensity rather than the
		// exponent.
		weighted := 100.0 * transmission * absorbed * sourceArea

		// The blur displacement is continuous, so split the light between the two
		// rhabdom offsets that bracket it.
		profile = deposit(profile, base+rhabdom, weighted*(1.0-frac))
		if frac > 0 {
			profile = deposit(profile, base+rhabdom+1, weighted*frac)
		}
	}
	return profile
}

// ringArea is the area, in squared facet widths, of the annulus of rhabdoms lying at
// the given whole-rhabdom offset from the optic axis. It is the same measure used to
// weight the contributing facets, so dividing an area-weighted total by it yields a
// radial area density.
func ringArea(offset int) float64 {
	if offset == 0 {
		return math.Pi * 0.25
	}
	outer := math.Pi * math.Pow(float64(offset)+0.5, 2)
	inner := math.Pi * math.Pow(float64(offset)-0.5, 2)
	return outer - inner
}

// deposit adds an amount at the given offset, growing the slice as required. Earlier
// versions used a fixed 21-element array and silently discarded everything beyond it,
// which lost up to a quarter of the absorbed light for widely blurred eyes.
func deposit(dst []float64, offset int, amount float64) []float64 {
	if amount == 0 {
		return dst
	}
	for len(dst) <= offset {
		dst = append(dst, 0)
	}
	dst[offset] += amount
	return dst
}

// blockSummary holds the resolution and sensitivity derived from one pigment block.
type blockSummary struct {
	// FWHMDegrees is the full width at half maximum of the point spread function, in
	// degrees. NaN when the profile carries no light at all.
	FWHMDegrees float64
	// SensitivityPercent is the percentage of incident light absorbed, averaged over
	// the eyeshine patch (0-100).
	SensitivityPercent float64
	// PeakOffset is the rhabdom offset carrying the most light. A non-zero value
	// means the profile is annular and its FWHM is not a simple acceptance angle.
	PeakOffset int
}

// summariseBlock converts one block's area-weighted absorption profile into
// resolution and sensitivity.
func (m *Model) summariseBlock(rhabdoms []float64) blockSummary {
	out := blockSummary{FWHMDegrees: math.NaN()}

	// Sensitivity: the area-weighted mean of the absorbed percentage over the
	// eyeshine patch. The facet weights telescope to exactly pi*(N-0.5)^2, so
	// dividing by that area makes this a true weighted mean in the range 0-100.
	total := 0.0
	for _, v := range rhabdoms {
		total += v
	}
	patchArea := math.Pi * math.Pow(float64(m.NumberOfFacets)-0.5, 2)
	if patchArea > 0 {
		out.SensitivityPercent = total / patchArea
	}

	if len(rhabdoms) == 0 {
		return out
	}

	// Point spread function: light per unit area at each rhabdom offset. The
	// contributing facets are weighted by their source annulus, so the light arriving
	// at an offset must be divided by the annulus it is spread over to recover an
	// intensity. Without this the profile rises monotonically with offset simply
	// because outer annuli contain more ommatidia.
	//
	// The profile ends at the outermost rhabdom that receives any light, so the next
	// offset out is genuinely dark. Including that zero captures the falling edge of
	// the blur circle, which is where a top-hat profile crosses its half maximum.
	psf := make([]float64, len(rhabdoms)+1)
	for j := range rhabdoms {
		psf[j] = rhabdoms[j] / ringArea(j)
	}

	peak := 0
	for j, v := range psf {
		if v > psf[peak] {
			peak = j
		}
	}
	out.PeakOffset = peak
	if psf[peak] <= 0 {
		return out
	}
	half := psf[peak] / 2.0

	// Walk outwards from the peak to the first crossing of the half maximum and
	// interpolate linearly between the bracketing offsets.
	for i := peak; i < len(psf)-1; i++ {
		if psf[i] >= half && psf[i+1] < half {
			frac := (psf[i] - half) / (psf[i] - psf[i+1])
			crossing := float64(i) + frac
			out.FWHMDegrees = 2.0 * (crossing - float64(peak)) * m.OmmatidialAngle
			break
		}
	}
	return out
}

// summariseMatrices turns the per-state summaries into the two output matrices, in
// both CSV and structured form.
func summariseMatrices(summaries []blockSummary) (
	resCsv string, senCsv string, matrixRes [][]Metric, matrixSens [][]Metric, warnings []string, err error) {

	if len(summaries) != pigmentSteps*pigmentSteps {
		return "", "", nil, nil, nil, fmt.Errorf("expected %d pigment states, got %d",
			pigmentSteps*pigmentSteps, len(summaries))
	}

	matrixRes = make([][]Metric, pigmentSteps)
	matrixSens = make([][]Metric, pigmentSteps)
	var resBuf, senBuf strings.Builder
	for row := 0; row < pigmentSteps; row++ {
		matrixRes[row] = make([]Metric, pigmentSteps)
		matrixSens[row] = make([]Metric, pigmentSteps)
		resCells := make([]string, pigmentSteps)
		senCells := make([]string, pigmentSteps)
		for col := 0; col < pigmentSteps; col++ {
			s := summaries[row*pigmentSteps+col]
			matrixRes[row][col] = Metric(s.FWHMDegrees)
			matrixSens[row][col] = Metric(s.SensitivityPercent)
			resCells[col] = strconv.FormatFloat(s.FWHMDegrees, 'f', 4, 64)
			senCells[col] = strconv.FormatFloat(s.SensitivityPercent, 'f', 4, 64)
		}
		fmt.Fprintln(&resBuf, strings.Join(resCells, ","))
		fmt.Fprintln(&senBuf, strings.Join(senCells, ","))
	}

	undefined, annular := 0, 0
	for _, s := range summaries {
		if math.IsNaN(s.FWHMDegrees) {
			undefined++
		}
		if s.PeakOffset != 0 {
			annular++
		}
	}
	if undefined > 0 {
		warnings = append(warnings, fmt.Sprintf(
			"%d of %d pigment states have no half-maximum crossing; their resolution is undefined.",
			undefined, len(summaries)))
	}
	if annular > 0 {
		warnings = append(warnings, fmt.Sprintf(
			"%d of %d pigment states peak away from the optic axis (annular profile); their FWHM is not a simple acceptance angle.",
			annular, len(summaries)))
	}

	return strings.TrimSpace(resBuf.String()), strings.TrimSpace(senBuf.String()), matrixRes, matrixSens, warnings, nil
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

		numbers := make([]float64, 9)
		bad := false
		for i := 1; i < 10; i++ {
			v, err := strconv.ParseFloat(strings.TrimSpace(record[i]), 64)
			if err != nil {
				log.Printf("Skipping record %q: field %d (%q) is not a number", species, i+1, record[i])
				bad = true
				break
			}
			numbers[i-1] = v
		}
		if bad {
			continue
		}

		paramsList = append(paramsList, Parameters{
			SpeciesName:              species,
			RhabdomLength:            numbers[0],
			RhabdomWidth:             numbers[1],
			EyeDiameter:              numbers[2],
			FacetWidth:               numbers[3],
			ApertureDiameter:         numbers[4],
			CytoplasmRefractiveIndex: numbers[5],
			RhabdomRefractiveIndex:   numbers[6],
			BlurCircleExtent:         numbers[7],
			ProximalRhabdomAngle:     numbers[8],
		})
	}

	if len(paramsList) == 0 {
		return nil, fmt.Errorf("no valid parameter rows found in input")
	}

	return paramsList, nil
}

// RunSimulation runs the simulation for a single parameter set in memory.
func RunSimulation(p Parameters, debugMode bool) (*SimulationResult, error) {
	model, err := NewModel(p)
	if err != nil {
		return nil, err
	}
	model.DebugMode = debugMode

	pathlengthsCsv, debugCsv, summaries, lostRays := model.runModelInMemory()
	resCsv, senCsv, matrixRes, matrixSens, warnings, err := summariseMatrices(summaries)
	if err != nil {
		return nil, err
	}
	if lostRays > 0 {
		warnings = append(warnings, fmt.Sprintf(
			"%d of %d rays exceeded 90 degrees to the rhabdom axis and were discarded.",
			lostRays, pigmentSteps*pigmentSteps*model.NumberOfFacets))
	}

	return &SimulationResult{
		SpeciesName: p.SpeciesName,
		Params:      p,
		CalculatedStats: CalculatedStats{
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
		},
		SummaryResCsv:  resCsv,
		SummarySenCsv:  senCsv,
		PathlengthsCsv: pathlengthsCsv,
		DebugCsv:       debugCsv,
		MatrixRes:      matrixRes,
		MatrixSens:     matrixSens,
		Warnings:       warnings,
	}, nil
}

// RunAllSimulations processes an input CSV and returns all simulation results,
// together with a message for each parameter set that could not be simulated.
func RunAllSimulations(csvContent string, debugMode bool) ([]*SimulationResult, []string, error) {
	paramsList, err := ParseInputParametersString(csvContent)
	if err != nil {
		return nil, nil, err
	}

	var results []*SimulationResult
	var skipped []string
	for _, p := range paramsList {
		res, err := RunSimulation(p, debugMode)
		if err != nil {
			skipped = append(skipped, fmt.Sprintf("%s: %v", p.SpeciesName, err))
			continue
		}
		results = append(results, res)
	}

	if len(results) == 0 {
		return nil, skipped, fmt.Errorf("no parameter set could be simulated: %s", strings.Join(skipped, "; "))
	}

	return results, skipped, nil
}

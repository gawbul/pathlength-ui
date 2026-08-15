import type { CalculatedStats, EyeParameters, SimulationResult } from '../types/simulation';

const DEG_TO_RAD = Math.PI / 180.0;

export function runSimulationTS(p: EyeParameters, debugMode = false): SimulationResult {
  const startTime = performance.now();

  const circumferenceOfEye = Math.PI * p.eyeDiameter;
  const apertureRadius = p.apertureDiameter / 2.0;
  const eyeRadius = p.eyeDiameter / 2.0;
  const distanceToAperture = Math.sqrt(Math.pow(eyeRadius, 2) - Math.pow(apertureRadius, 2));
  const angleAtCenter = Math.atan(apertureRadius / distanceToAperture) / DEG_TO_RAD;
  const apertureArc = (angleAtCenter / 360.0) * circumferenceOfEye;
  const ommatidialAngle = (p.facetWidth / circumferenceOfEye) * 360.0;
  const rhabdomRadius = p.rhabdomWidth / 2.0;
  const numberOfFacets = Math.round(apertureArc / p.facetWidth);

  const snellsLaw = Math.asin(p.cytoplasmRefractiveIndex / p.rhabdomRefractiveIndex);
  const criticalAngle = 90.0 - snellsLaw / DEG_TO_RAD;

  const stats: CalculatedStats = {
    circumferenceOfEye,
    apertureRadius,
    eyeRadius,
    distanceToAperture,
    angleAtCenter,
    apertureArc,
    ommatidialAngle,
    numberOfFacets,
    rhabdomRadius,
    criticalAngle,
  };

  const oldRhabdomLength = p.rhabdomLength;
  const incrementAmount = p.rhabdomLength / 10.0;

  const pathlengthLines: string[] = [];
  const debugLines: string[] = [];

  for (let pStep = 0; pStep <= 10; pStep++) {
    const shieldingPigment = pStep * incrementAmount;
    for (let tStep = 0; tStep <= 10; tStep++) {
      const tapetalPigment = tStep * incrementAmount;

      pathlengthLines.push(shieldingPigment.toFixed(6));
      pathlengthLines.push(tapetalPigment.toFixed(6));

      if (debugMode) {
        debugLines.push(`P: ${shieldingPigment.toFixed(2)}, T: ${tapetalPigment.toFixed(2)}`);
      }

      for (let currentFacet = 0; currentFacet < numberOfFacets; currentFacet++) {
        const incidenceOmmatidialAngle = currentFacet * ommatidialAngle;
        let refractedOmmatidialAngle = 0.0;

        if (incidenceOmmatidialAngle === 0) {
          refractedOmmatidialAngle = 0.0;
        } else if (incidenceOmmatidialAngle > 0 && incidenceOmmatidialAngle <= 15) {
          refractedOmmatidialAngle = incidenceOmmatidialAngle * 0.9494 + 0.004667;
        } else if (incidenceOmmatidialAngle > 15 && incidenceOmmatidialAngle <= 35) {
          refractedOmmatidialAngle = incidenceOmmatidialAngle * 0.9407 + 0.1648;
        } else if (incidenceOmmatidialAngle > 35 && incidenceOmmatidialAngle <= 50) {
          refractedOmmatidialAngle = incidenceOmmatidialAngle * 0.9196 + 0.8676;
        } else if (incidenceOmmatidialAngle > 50 && incidenceOmmatidialAngle <= 60) {
          refractedOmmatidialAngle = incidenceOmmatidialAngle * 0.8677 + 3.38;
        } else if (incidenceOmmatidialAngle > 60) {
          refractedOmmatidialAngle = 60.0;
        }

        let facetNum = 1.0;
        if (refractedOmmatidialAngle === 0) {
          facetNum = 1.0;
        } else {
          const cc = p.facetWidth / Math.abs(Math.tan(refractedOmmatidialAngle * DEG_TO_RAD));
          let fw = 0.0;
          if (cc > p.facetWidth * 2.0) {
            fw = Math.cos(incidenceOmmatidialAngle * DEG_TO_RAD) * p.facetWidth;
          } else {
            const ll = 2.0 * cc - 2.0 * p.facetWidth;
            fw = Math.sin(incidenceOmmatidialAngle * DEG_TO_RAD) * ll;
          }
          facetNum = fw / p.facetWidth;
        }

        if (facetNum > 1.0) facetNum = 1.0;
        if (facetNum < 0.0) facetNum = 0.0;

        const rowData: string[] = [];
        let boa = refractedOmmatidialAngle;

        if (p.blurCircleExtent > 0) {
          const fd = numberOfFacets / p.blurCircleExtent;
          for (let i = 1; i <= Math.floor(p.blurCircleExtent); i++) {
            if (currentFacet > fd * i) {
              boa += ommatidialAngle;
              rowData.push('0');
            }
          }
        }

        let rhabdomLength = oldRhabdomLength;
        let cz = 0;

        while (true) {
          if (boa > criticalAngle && cz === 0) {
            boa -= p.proximalRhabdomAngle;
          }

          if (incidenceOmmatidialAngle === 0) {
            let val = 0.0;
            if (tapetalPigment === 0 || shieldingPigment > 0) {
              val = rhabdomLength * facetNum;
            } else {
              val = rhabdomLength * 2.0 * facetNum;
            }
            rowData.push(val.toFixed(6));
            break;
          }

          const y = rhabdomRadius / Math.abs(Math.tan(boa * DEG_TO_RAD));

          if (y >= rhabdomLength) {
            let x = 0.0;
            const mx = Math.sqrt(Math.pow(rhabdomLength, 2) + Math.pow(rhabdomRadius, 2));
            if (y === rhabdomLength) {
              x = mx;
            } else {
              x = rhabdomLength / Math.abs(Math.cos(boa * DEG_TO_RAD));
            }
            const v = x > oldRhabdomLength ? x : oldRhabdomLength;
            let val = 0.0;
            if (tapetalPigment === 0 || shieldingPigment > 0) {
              val = x * facetNum;
            } else {
              val = (x + v) * facetNum;
            }
            rowData.push(val.toFixed(6));
            break;
          } else if (
            y > rhabdomLength - shieldingPigment ||
            y > rhabdomLength - tapetalPigment ||
            boa < criticalAngle
          ) {
            const x = rhabdomRadius / Math.abs(Math.sin(boa * DEG_TO_RAD));
            let z = (rhabdomLength - y) / Math.abs(Math.cos(boa * DEG_TO_RAD));
            if (z > x) z = x;
            const v = x + z > oldRhabdomLength ? x + z : oldRhabdomLength;
            let val = 0.0;
            if (tapetalPigment === 0) {
              val = (x + z) * facetNum;
            } else {
              val = (x + z + v) * facetNum;
            }
            if (shieldingPigment > 0) {
              val = (x + z) * facetNum;
            }
            if (shieldingPigment > rhabdomLength - y) {
              val = x * facetNum;
            }
            rowData.push(val.toFixed(6));
            break;
          } else {
            const x = rhabdomRadius / Math.abs(Math.sin(boa * DEG_TO_RAD));
            rowData.push((x * facetNum).toFixed(6));
            rhabdomLength -= y;
            boa += ommatidialAngle;
            cz = 1;
            if (rhabdomLength <= tapetalPigment || rhabdomLength <= shieldingPigment) {
              break;
            }
          }
        }

        pathlengthLines.push(rowData.join(','));
      }

      pathlengthLines.push('999');
    }
  }

  const pathlengthsCsv = pathlengthLines.join('\n');
  const debugCsv = debugLines.join('\n');

  // Calculate resolution & sensitivity matrices
  const { summaryResCsv, summarySenCsv, matrixRes, matrixSens } = calculateRessens(
    pathlengthsCsv,
    ommatidialAngle
  );

  const endTime = performance.now();

  return {
    speciesName: p.speciesName,
    params: p,
    calculatedStats: stats,
    summaryResCsv,
    summarySenCsv,
    pathlengthsCsv,
    debugCsv,
    matrixRes,
    matrixSens,
    executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
  };
}

function calculateRessens(pathlengthsContent: string, ommatidialAngle: number) {
  let rhabdoms = new Array<number>(21).fill(0);
  const matrixSens: number[][] = [];
  const matrixRes: number[][] = [];
  let currentSensRow: number[] = [];
  let currentResRow: number[] = [];

  let facet = 0.0;
  let arem = 0.0;
  let cc = 0;
  let dd = 0;
  let headerCount = 0;

  const lines = pathlengthsContent.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === '999') {
      let sens = 0.0;
      for (const r of rhabdoms) {
        sens += r;
      }
      const halfwayPoint = rhabdoms[0] / 2.0;
      let opticAxis = 0.0;
      let xz = rhabdoms[0];
      let yy = rhabdoms[1] || 0;

      for (let i = 1; i < 12; i++) {
        if (halfwayPoint < rhabdoms[i]) {
          xz = rhabdoms[i];
          if (i + 1 < rhabdoms.length) {
            yy = rhabdoms[i + 1];
          }
          opticAxis = ommatidialAngle * i;
        }
      }

      const diff = xz - yy;
      const hwp = xz - halfwayPoint;
      let frac = 0.0;
      if (diff > 0 && hwp >= 0) {
        frac = Math.min(1.0, Math.max(0.0, hwp / (diff + 0.1)));
      }
      const oab = frac * ommatidialAngle;
      let res = oab + opticAxis;
      if (res < 0) {
        res = 0;
      }

      if (cc === 0 && dd > 0) {
        matrixSens.push([...currentSensRow]);
        matrixRes.push([...currentResRow]);
        currentSensRow = [];
        currentResRow = [];
      }

      const sensVal = arem > 0 ? Math.floor(sens / arem) : 0;
      const resVal = Math.floor(res * 200.0);

      currentSensRow.push(sensVal);
      currentResRow.push(resVal);

      cc++;
      if (cc === 11) {
        dd++;
        cc = 0;
      }

      rhabdoms = new Array<number>(21).fill(0);
      facet = 0;
      headerCount = 0;
    } else if (headerCount < 2) {
      headerCount++;
    } else {
      const parts = line.split(',');
      let rhabdom = 0;
      let tot = 0.0;
      const area = Math.PI * Math.pow(facet + 0.5, 2);
      const inci = facet === 0 ? 0 : Math.PI * Math.pow(facet - 0.5, 2);
      const torus = area - inci;
      if (area > arem) {
        arem = area;
      }

      for (const part of parts) {
        const pathlength = parseFloat(part);
        const absorbance = pathlength > 0 ? 1 - Math.exp(-0.01 * pathlength) : 0;
        let bx = 0.0;
        if (rhabdom === 0 && absorbance > 0) {
          bx = 100 * absorbance;
        } else if (rhabdom > 0 && absorbance > 0) {
          bx = 100 * ((1 - tot) * absorbance);
        }
        if (absorbance === 0) {
          bx = 0;
        }
        tot += bx / 100.0;
        bx *= torus;
        if (rhabdom < rhabdoms.length) {
          rhabdoms[rhabdom] += bx;
        }
        rhabdom++;
      }
      facet++;
    }
  }

  if (currentSensRow.length > 0) {
    matrixSens.push([...currentSensRow]);
    matrixRes.push([...currentResRow]);
  }

  const summaryResCsv = matrixRes.map((row) => row.join(',')).join('\n');
  const summarySenCsv = matrixSens.map((row) => row.join(',')).join('\n');

  return { summaryResCsv, summarySenCsv, matrixRes, matrixSens };
}

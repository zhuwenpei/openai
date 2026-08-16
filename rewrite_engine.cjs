const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');

// 1. History now saves every 1 hour (instead of 3 hours)
code = code.replace(
  `if (nextHour - lastHistoryHour >= 3) {`,
  `if (nextHour - lastHistoryHour >= 1) {`
);

// 2. We need to implement land coverage calculation.
const landCoverageFunction = `
export function getLandCoverage(lat: number, lon: number, radiusKm: number): number {
  if (radiusKm <= 0) return 0;
  let landPoints = 0;
  const totalPoints = 16;
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / totalPoints) * Math.PI * 2;
    const r = radiusKm * 0.7; // sample at 70% of radius
    const dLat = (r * Math.cos(angle)) / 111.0;
    const dLon = (r * Math.sin(angle)) / (111.0 * Math.cos(lat * Math.PI / 180));
    if (getLandMetrics(lat + dLat, lon + dLon).isLand) {
      landPoints++;
    }
  }
  return landPoints / totalPoints;
}
`;
if (!code.includes('getLandCoverage')) {
  code = code.replace('export function getDistanceToLand', landCoverageFunction + '\nexport function getDistanceToLand');
}

// 3. Let's rewrite the intensity calculation. 
// I'll extract the whole block between "let vmaxDeltaPerHour =" and "// Dynamic states"
const intensityBlockStart = "      let vmaxDeltaPerHour = favScore * 1.6; // average growth speed";
const intensityBlockEnd = "      // Dynamic states";
const startIdx = code.indexOf(intensityBlockStart);
const endIdx = code.indexOf(intensityBlockEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `      // --- NEW INTENSITY ENGINE ---
      // We start with the base physical potential
      let vmaxDeltaPerHour = favScore * 1.6; 
      
      if (coldWaterDecay > 0) {
        vmaxDeltaPerHour -= coldWaterDecay;
      }
      
      // Enforce physical constraints from environment
      if (sstVal <= 26.5 && vmaxDeltaPerHour > 0) {
        vmaxDeltaPerHour = -0.5; // force decay if SST <= 26.5
      }

      // Smooth approaching to User Slider Limit
      // REMOVED ALL FIXED LIMITS (like 80m/s or 50m/s constraints)
      if (config.maxIntensityLimitEnabled && config.maxIntensityLimit) {
        const sliderLimit = config.maxIntensityLimit;
        
        if (ty.vmax > sliderLimit) {
           // Smoothly decrease back to slider limit if we somehow exceeded it (e.g. slider was lowered)
           const excess = ty.vmax - sliderLimit;
           vmaxDeltaPerHour = -Math.max(0.5, excess * 0.15); 
        } else if (vmaxDeltaPerHour > 0) {
           // Smooth non-linear approach to the slider limit
           const distanceToLimit = Math.max(0, sliderLimit - ty.vmax);
           const approachFactor = Math.min(1.0, distanceToLimit / 15.0); 
           // When within 15m/s of limit, growth slows down smoothly
           vmaxDeltaPerHour *= approachFactor;
        }
      }

      // Landfall Decay Mechanism (New Model)
      // Calculates based on coverage, terrain, and distance
      if (metrics.isLand || r7TouchesLand) {
         let coverage = 0;
         if (metrics.isLand) coverage = 1.0;
         else if (r7) coverage = getLandCoverage(newLat, newLon, (r7.ne + r7.nw + r7.sw + r7.se)/4);

         const elN = getLandMetrics(newLat + 0.45, newLon).elevation;
         const elS = getLandMetrics(newLat - 0.45, newLon).elevation;
         const elE = getLandMetrics(newLat, newLon + 0.45).elevation;
         const elW = getLandMetrics(newLat, newLon - 0.45).elevation;
         const avgElevation = (metrics.elevation + elN + elS + elE + elW) / 5;
         
         const elevationFactor = avgElevation / 1000.0;
         const baseLandDecay = 1.5 + elevationFactor * 2.5; // Mountainous terrain destroys storm faster
         
         // Weakens slower when weak
         let intensityFactor = 1.0;
         if (ty.vmax < 25) intensityFactor = 0.5;
         else if (ty.vmax > 50) intensityFactor = 1.5;

         const finalLandDecay = baseLandDecay * coverage * intensityFactor;
         
         if (config.landDecayEnabled && finalLandDecay > 0) {
            vmaxDeltaPerHour = -finalLandDecay;
         }
      }
      
      // Limit acceleration bounds
      vmaxDeltaPerHour = Math.max(-10.0, Math.min(8.0, vmaxDeltaPerHour));
      
`;
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
}

// 4. Also remove the old Intensity Limiter Enforcement chunk down below
const limiterStart = "      // Intensity Limiter Enforcement";
const limiterEnd = "      // A. Rapid Intensification (RI) trigger";
const lStartIdx = code.indexOf(limiterStart);
const lEndIdx = code.indexOf(limiterEnd);
if (lStartIdx !== -1 && lEndIdx !== -1) {
  code = code.substring(0, lStartIdx) + code.substring(lEndIdx);
}

// 5. Remove the EWRC fixed logic if it forces decay near limits or random oscillations
// "const canAuto = config.ewrcTrigger === 'auto' && ewrcState === 'none' && ty.vmax > 45.0 && vmaxDeltaPerHour > 0 && this.prng.next() < prob;"
code = code.replace(
    /if \(ty\.vmax > 45\.0 && ty\.vmax <= 70\.0\) \{[\s\S]*?\} else if \(ty\.vmax > 68\.0\) \{[\s\S]*?\}/g,
    `if (ty.vmax > 45.0) { prob = 0.01 + Math.max(0, (ty.vmax - 45) / 1000.0); }`
);
code = code.replace(
    /if \(ty\.vmax > 45\.0 && ty\.vmax <= 70\.0\) \{[\s\S]*?\} else if \(ty\.vmax > 68\.0\) \{[\s\S]*?failureProb = 0\.60;[\s\S]*?\}/g,
    `if (ty.vmax > 45.0) { failureProb = shearVal <= 18.0 && !isVeryCloseToLand ? 0.04 : 0.40; }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);
console.log('Engine.ts updated part 1');

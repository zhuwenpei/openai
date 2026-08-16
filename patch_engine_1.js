import fs from 'fs';
let content = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// 1. Coverage
content = content.replace(
  '        coverage = metrics.isLand ? 1.0 : getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource);\n        const terrainSample = getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);\n        maxElevation = terrainSample.maxElevation;\n      }',
  '        coverage = metrics.isLand ? 1.0 : (fastMode ? 0 : getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource));\n        const terrainSample = fastMode ? { maxElevation: metrics.isLand ? metrics.elevation : 0 } : getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);\n        maxElevation = terrainSample.maxElevation;\n      }'
);

// 2. Structure damage over ocean
content = content.replace(
  '      } else {\n        // Over ocean\n        if (maxLandElevationPassed > 1500) {',
  '      } else {\n        // Over ocean\n        if (maxLandElevationPassed > 500 || landHours > 4 || ty.consecutiveUpwellingHours > 6) {'
);

// 3. Structure damage penalty check
content = content.replace(
  '      if (isStructureDamaged && !metrics.isLand) {\n        if (maxLandElevationPassed > 1500) {',
  '      if (isStructureDamaged && !metrics.isLand) {\n        if (maxLandElevationPassed > 500 || forecastLandHours > 4 || forecastConsecutiveUpwellingHours > 6) {'
);

// 4. Wave drift limitation
content = content.replace(
  '      const maxDrift = 1.8 * finalNoiseVal;\n      u_drift = Math.max(-maxDrift, Math.min(maxDrift, u_drift));\n      v_drift = Math.max(-maxDrift, Math.min(maxDrift, v_drift));\n\n      // Stronger Restoring Force:',
  '      const maxDrift = 1.2 * finalNoiseVal;\n      u_drift = Math.max(-maxDrift, Math.min(maxDrift, u_drift));\n      v_drift = Math.max(-maxDrift, Math.min(maxDrift, v_drift));\n\n      const maxDistortion = Math.max(0.5, steeringStrength * 0.8);\n      const waveMag = Math.sqrt(waveU*waveU + waveV*waveV);\n      if (waveMag > maxDistortion) {\n         waveU = (waveU / waveMag) * maxDistortion;\n         waveV = (waveV / waveMag) * maxDistortion;\n      }\n\n      // Stronger Restoring Force:'
);

fs.writeFileSync('src/simulation/Engine.ts', content);

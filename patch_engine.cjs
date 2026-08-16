const fs = require('fs');
let content = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// 1. Fix the `getLandCoverage` and `getMaxElevationInRadius` in calculateForecastPath
content = content.replace(
  '        coverage = metrics.isLand ? 1.0 : getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource);\n        const terrainSample = getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);\n        maxElevation = terrainSample.maxElevation;',
  '        coverage = metrics.isLand ? 1.0 : (fastMode ? 0 : getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource));\n        const terrainSample = fastMode ? { maxElevation: metrics.elevation } : getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);\n        maxElevation = terrainSample.maxElevation;'
);

// 2. Fix structure damage triggers in stepSimulation (around line 1850)
// We want to trigger it if maxLandElevationPassed > 500 or landHours > 4
// Or if upwelling is active for > 6 hours.
// Wait, we need to do this carefully. Let's find the exact block.

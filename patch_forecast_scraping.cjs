const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `    if (metrics.isLand || forecastR10TouchesLand) {`,
  `    if (metrics.isLand || forecastR10TouchesLand || r7TouchesLand) {`
);

code = code.replace(
  `        coverage = metrics.isLand ? 1.0 : (fastMode ? 0 : getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource));
        const terrainSample = fastMode ? { maxElevation: metrics.isLand ? metrics.elevation : 0 } : getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);`,
  `        coverage = metrics.isLand ? 1.0 : (fastMode ? 0 : (forecastR10TouchesLand ? getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource) : getLandCoverage(currentLat, currentLon, baseR7, config?.coastlineSource) * 0.3));
        const terrainSample = fastMode ? { maxElevation: metrics.isLand ? metrics.elevation : 0 } : getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

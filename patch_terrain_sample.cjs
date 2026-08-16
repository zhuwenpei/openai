const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `         // Sample terrain elevation across the entire 12-level wind circle (r12) area
         const r12Radius = (r12 && r12.ne > 0) ? (r12.ne + r12.nw + r12.se + r12.sw)/4 : (r10 ? (r10.ne + r10.nw)/2 * 0.7 : 35);
         const terrainSample = getMaxElevationInRadius(newLat, newLon, r12Radius, config?.coastlineSource);`,
  `         // Sample terrain elevation across the entire 12-level wind circle (r12) area
         // Requirement 2: Increase scraping high terrain land effect. Sample using r7 radius if scraping to catch the mountains.
         const r12Radius = (r12 && r12.ne > 0) ? (r12.ne + r12.nw + r12.se + r12.sw)/4 : (r10 ? (r10.ne + r10.nw)/2 * 0.7 : 35);
         const searchRadius = r7TouchesLand ? ((r7.ne + r7.nw + r7.se + r7.sw)/4) : r12Radius;
         const terrainSample = getMaxElevationInRadius(newLat, newLon, searchRadius, config?.coastlineSource);`
);

code = code.replace(
  `        const terrainSample = fastMode ? { maxElevation: metrics.isLand ? metrics.elevation : 0 } : getMaxElevationInRadius(currentLat, currentLon, r12Radius, config?.coastlineSource);`,
  `        const terrainSample = fastMode ? { maxElevation: metrics.isLand ? metrics.elevation : 0 } : getMaxElevationInRadius(currentLat, currentLon, baseR7, config?.coastlineSource);`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

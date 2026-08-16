const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// In active simulation (line 2540 area)
code = code.replace(
  `      if (metrics.isLand || r10TouchesLand) {
         let coverage = 0;
         if (metrics.isLand) coverage = 1.0;
         else if (r10) coverage = getLandCoverage(newLat, newLon, (r10.ne + r10.nw + r10.sw + r10.se)/4, config?.coastlineSource);`,
  `      // Requirement 2: Increase decay when scraping high terrain land (trigger even if 7-level wind circle touches)
      const r7TouchesLand = r7 ? checkWindCircleTouchLand(newLat, newLon, r7, config?.coastlineSource) : false;
      if (metrics.isLand || r10TouchesLand || r7TouchesLand) {
         let coverage = 0;
         if (metrics.isLand) coverage = 1.0;
         else if (r10TouchesLand && r10) coverage = getLandCoverage(newLat, newLon, (r10.ne + r10.nw + r10.sw + r10.se)/4, config?.coastlineSource);
         else if (r7TouchesLand && r7) coverage = getLandCoverage(newLat, newLon, (r7.ne + r7.nw + r7.sw + r7.se)/4, config?.coastlineSource) * 0.3; // r7 coverage has less impact`
);

// In forecast (line 4118 area approx)
// Let's check how forecast checks land touch.
code = code.replace(
  `    let forecastR10TouchesLand = false;
    let r10Radius = 150;
    let r12Radius = 50;`,
  `    let forecastR10TouchesLand = false;
    let forecastR7TouchesLand = false;
    let r10Radius = 150;
    let r12Radius = 50;
    let r7Radius = 250;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

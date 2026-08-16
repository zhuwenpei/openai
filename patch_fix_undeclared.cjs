const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `  let forecastIsStructureDamaged = typhoon.isStructureDamaged || false;`,
  `  let forecastIsStructureDamaged = typhoon.isStructureDamaged || false;
  let forecastPassedTaiwan = typhoon.passedTaiwanCentral || false;`
);

code = code.replace(
  `      if (metrics.isLand) {
        forecastLandHours += stepSizeHours;
        if (metrics.elevation > forecastMaxLandElevationPassed) forecastMaxLandElevationPassed = metrics.elevation;`,
  `      if (metrics.isLand) {
        forecastLandHours += stepSizeHours;
        if (metrics.elevation > forecastMaxLandElevationPassed) {
          forecastMaxLandElevationPassed = metrics.elevation;
          if (metrics.elevation > 1500 && currentLat >= 21.5 && currentLat <= 25.5 && currentLon >= 119.5 && currentLon <= 122.5) {
             forecastPassedTaiwan = true;
          }
        }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

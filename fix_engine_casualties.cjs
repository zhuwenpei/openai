const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');

const targetStr = "let upwellingHours = ty.upwellingHours || 0;";
const casualtiesInit = "let currentCasualties = ty.casualties || 0;";

if (!code.includes(casualtiesInit)) {
  code = code.replace(targetStr, targetStr + "\\n      " + casualtiesInit);
}

const updateStr = "if (config.landDecayEnabled && finalLandDecay > 0) {";
const casualtiesCalc = `
         // Casualties estimation
         if (ty.vmax > 17 && (metrics.isLand || r7TouchesLand)) {
            // Very simple population density heuristic based on coordinates (e.g. dense in East China, Japan, Philippines)
            let basePopDensity = 100; // people per sq km
            if (newLat > 20 && newLat < 40 && newLon > 110 && newLon < 125) basePopDensity = 500; // Eastern China / Taiwan
            else if (newLat > 30 && newLat < 45 && newLon > 128 && newLon < 145) basePopDensity = 300; // Japan / Korea
            else if (newLat > 5 && newLat < 20 && newLon > 115 && newLon < 125) basePopDensity = 400; // Philippines
            
            // Damage scaling by wind speed (power of 3 is typical for wind damage)
            const windDamageFactor = Math.max(0, Math.pow(ty.vmax / 30.0, 3)); 
            const rainDamageFactor = (ty.vmax / 20.0) * (avgElevation > 200 ? 1.5 : 1.0); // Rain + terrain = floods/landslides
            
            // Affected area roughly proportional to r7 (or standard 100km radius)
            const area = Math.PI * Math.pow(Math.max(50, r7 ? (r7.ne+r7.nw)/2 : 50), 2);
            
            // Casualties is a tiny fraction of affected population, accumulated over time
            // stepFraction is 1/6 hour
            const casualtiesThisStep = (area * basePopDensity * coverage * (windDamageFactor + rainDamageFactor)) * 0.0000005 * stepFraction;
            currentCasualties += casualtiesThisStep;
         }
`;
if (!code.includes('currentCasualties +=')) {
  code = code.replace(updateStr, casualtiesCalc + "\\n         " + updateStr);
}

// Update object assembly
code = code.replace(
  'upwellingHours,\n        tdHours,\n        etHours,',
  'upwellingHours,\n        tdHours,\n        etHours,\n        casualties: currentCasualties,'
);

code = code.replace(
  'upwellingHours\n          }',
  'upwellingHours,\n            casualties: currentCasualties\n          }'
);

fs.writeFileSync('src/simulation/Engine.ts', code);

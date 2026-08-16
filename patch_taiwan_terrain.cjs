const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// Engine.ts Steering flow penalty
code = code.replace(
  `          // Substantially weaken Taiwan mountain decay bonus (Taiwan: 21.5-25.5N, 119.5-122.5E)
          if (newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5) {
            elevationScale = 4200.0; // Slightly stronger terrain effect
            terrainMulti = 0.44; 
          }`,
  `          // Substantially weaken Taiwan mountain decay bonus (Taiwan: 21.5-25.5N, 119.5-122.5E)
          if (newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5) {
            elevationScale = 3800.0; // Slightly stronger terrain effect (increased)
            terrainMulti = 0.48; 
          }`
);

// Engine.ts Landfall Intensity decay
code = code.replace(
  `         // Taiwan mountain decay bonus (slightly strengthened further) (Requirement 3)
         if (newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5) {
            // Taiwan Central Mountain Range
            elevationScale = 6800.0; 
            terrainMulti = 0.42; 
            if (ty.vmax > 30.0) {
              const taiwanShred = 1.0 + Math.pow((ty.vmax - 30.0) / 12.0, 1.2) * 0.32;
              terrainMulti *= taiwanShred;
            }
         }`,
  `         // Taiwan mountain decay bonus (slightly strengthened further) (Requirement 3)
         if (newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5) {
            // Taiwan Central Mountain Range
            elevationScale = 6200.0; 
            terrainMulti = 0.48; 
            if (ty.vmax > 30.0) {
              const taiwanShred = 1.0 + Math.pow((ty.vmax - 30.0) / 12.0, 1.2) * 0.38;
              terrainMulti *= taiwanShred;
            }
         }`
);

// Engine.ts Forecast Landfall Intensity decay
code = code.replace(
  `      if (currentLat >= 21.5 && currentLat <= 25.5 && currentLon >= 119.5 && currentLon <= 122.5) {
        elevationScale = 6800.0; // Synchronized with active simulation
        terrainMulti = 0.32; // Synchronized with active simulation
        if (currentVmax > 30.0) {
          const taiwanShred = 1.0 + Math.pow((currentVmax - 30.0) / 12.0, 1.2) * 0.28; // Synchronized with active simulation
          terrainMulti *= taiwanShred;
        }
      }`,
  `      if (currentLat >= 21.5 && currentLat <= 25.5 && currentLon >= 119.5 && currentLon <= 122.5) {
        elevationScale = 6200.0; // Synchronized with active simulation
        terrainMulti = 0.48; // Synchronized with active simulation
        if (currentVmax > 30.0) {
          const taiwanShred = 1.0 + Math.pow((currentVmax - 30.0) / 12.0, 1.2) * 0.38; // Synchronized with active simulation
          terrainMulti *= taiwanShred;
        }
      }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

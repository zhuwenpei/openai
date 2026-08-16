const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `  // Base SST profile: warm pool centered around 15°N, 137°E (peaks at 30.5-31.5°C in Sept)
  // Adjusted for accurate September climatology where warm water expands significantly north
  let baseSST = 30.5;
  
  // Non-linear latitude drop (Request: pivot at 29.3N, rapid drop north of it)
  let gradient = config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0;
  const pivotLat = 29.3;`,
  `  // Requirement 3: Global zoned SST based on presets
  let baseSST = config.sstBase !== undefined ? config.sstBase : 30.5;
  
  let gradient = config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0;
  const pivotLat = config.sstPivotLat !== undefined ? config.sstPivotLat : 29.3;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/  configSnapshot\?: SimulationConfig;\s*configSnapshot\?: SimulationConfig;/g, '  configSnapshot?: SimulationConfig;');
code = code.replace(/  configSnapshot\?: SimulationConfig;\s*simHour: number;/g, '  simHour: number;');
code = code.replace(/  configSnapshot\?: SimulationConfig;\s*direction: number;/g, '  direction: number;');

// For duplicate shear and dryAirStrength, let's fix it by adding them back correctly.
code = code.replace(/  shearScale: number; \/\/ 0 - 2/g, '  shearScale: number; // 0 - 2\n  shear?: number;\n  dryAirStrength?: number;\n  sstBase?: number;\n  sstPivotLat?: number;');

fs.writeFileSync('src/types.ts', code);

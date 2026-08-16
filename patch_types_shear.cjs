const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  `  windShear?: boolean;`,
  `  windShear?: boolean;\n  shear?: boolean;`
);

// Fix duplicate configSnapshot in types.ts
code = code.replace(/  configSnapshot\?: SimulationConfig;\n  configSnapshot\?: SimulationConfig;/g, '  configSnapshot?: SimulationConfig;');

// One more check for duplicated configSnapshot
code = code.replace(/  configSnapshot\?: SimulationConfig;\s+configSnapshot\?: SimulationConfig;/g, '  configSnapshot?: SimulationConfig;');

fs.writeFileSync('src/types.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/export interface SimulationConfig \{/,
  `export interface SimulationConfig {
  uiStyle?: "default" | "professional" | "ios";`);

fs.writeFileSync('src/types.ts', code);

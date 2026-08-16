const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');
code = code.replace(/lastVelocityV,\n              landfallRecords,/g, 
  "lastVelocityV,\n              forcedDecayStartVmax,\n              forcedDecayTargetVmax,\n              forcedDecayElapsedHours,\n              forcedDecayDuration,\n              forcedDecayIsContinuous,\n              landfallRecords,");
fs.writeFileSync('src/simulation/Engine.ts', code);

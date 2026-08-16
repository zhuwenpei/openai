const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// We need to define envQuality locally where it's used in stepTyphoon and forecast logic.
// In stepTyphoon (around line 2821), we can define it based on current metrics.
// Same in getForecastPath (around 4552).

code = code.replace(/targetDecayRate = Math\.min\(envQuality > 0\.65 \? 1\.2 : 2\.0, targetDecayRate\);/g, 
  `const localEnvQuality = Math.max(0, Math.min(1.0, (sstVal - 26.0) / 3.0 - shearVal / 22.0 + rhVal / 200.0));
         targetDecayRate = Math.min(localEnvQuality > 0.65 ? 1.2 : 2.0, targetDecayRate);`);

fs.writeFileSync('src/simulation/Engine.ts', code);

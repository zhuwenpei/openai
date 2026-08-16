const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `    const scale = config?.betaDriftScale ?? 1.0;
    const sizeFactor = Math.max(0.3, Math.min(2.0, baseR7 / 250.0));`,
  `    const scale = config?.betaDriftScale ?? 1.0;
    const betaDriftBaseR7 = currentVmax * 5.8 + 30;
    const sizeFactor = Math.max(0.3, Math.min(2.0, betaDriftBaseR7 / 250.0));`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

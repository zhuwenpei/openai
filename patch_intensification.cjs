const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// 1. In Simulation Engine
code = code.replace(
  `        const g_v = 1.6 / (1.0 + ty.vmax / 35.0); `,
  `        const g_v = 1.5 / (1.0 + Math.pow(ty.vmax / 50.0, 1.2)); `
);
code = code.replace(
  `        // Requirement 1: Base intensification rate reduced to 45%
        vmaxDeltaPerHour *= 0.45;`,
  `        // Requirement 1: Base intensification rate reduced to 60% of previous 45% -> 0.27
        vmaxDeltaPerHour *= 0.27;`
);

// 2. In Forecast Engine
code = code.replace(
  `      const g_v = 1.6 / (1.0 + currentVmax / 35.0); `,
  `      const g_v = 1.5 / (1.0 + Math.pow(currentVmax / 50.0, 1.2)); `
);
code = code.replace(
  `      // Synchronized with main simulation rate (Requirement 1: Base intensification rate reduced to 45%)
      vmaxDeltaPerHour *= 0.45;`,
  `      // Synchronized with main simulation rate (Requirement 1: Base intensification rate reduced to 0.27)
      vmaxDeltaPerHour *= 0.27;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

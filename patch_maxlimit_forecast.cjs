const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `  const maxLimit = config.maxIntensityLimitEnabled ? Math.min(config.maxIntensityLimit ?? 70, 72) : 70;`,
  `  const maxLimit = config.maxIntensityLimitEnabled ? Math.min(config.maxIntensityLimit ?? 105, 105) : 105;`
);

code = code.replace(
  `      const maxLimit = config.maxIntensityLimitEnabled ? Math.min(config.maxIntensityLimit ?? 70, 72) : 70;`,
  `      const maxLimit = config.maxIntensityLimitEnabled ? Math.min(config.maxIntensityLimit ?? 105, 105) : 105;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

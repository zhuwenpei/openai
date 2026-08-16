const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `          if (metrics.elevation > 1500 && ty.lat >= 21.5 && ty.lat <= 25.5 && ty.lon >= 119.5 && ty.lon <= 122.5) {
            ty.passedTaiwanCentral = true;
          }`,
  `          if (metrics.elevation > 1500 && ty.lat >= 21.5 && ty.lat <= 25.5 && ty.lon >= 119.5 && ty.lon <= 122.5) {
            passedTaiwanCentral = true;
          }`
);

code = code.replace(
  `            structuralDamagePenaltyFactor = ty.passedTaiwanCentral ? 0.05 : 0.2; // Max penalty`,
  `            structuralDamagePenaltyFactor = passedTaiwanCentral ? 0.05 : 0.2; // Max penalty`
);

code = code.replace(
  `            const basePenalty = ty.passedTaiwanCentral ? 0.05 : 0.2;`,
  `            const basePenalty = passedTaiwanCentral ? 0.05 : 0.2;`
);

code = code.replace(
  `              isStructureDamaged = false;
              ty.passedTaiwanCentral = false;`,
  `              isStructureDamaged = false;
              passedTaiwanCentral = false;`
);

code = code.replace(
  `          passedTaiwanCentral: ty.passedTaiwanCentral,`,
  `          passedTaiwanCentral,`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

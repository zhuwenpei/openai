const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// 1. Modify the land logic to record if passing Taiwan central mountain
code = code.replace(
  `        if (metrics.elevation > maxLandElevationPassed) {
          maxLandElevationPassed = metrics.elevation;
        }`,
  `        if (metrics.elevation > maxLandElevationPassed) {
          maxLandElevationPassed = metrics.elevation;
          // Requirement 4: Check if passing through Taiwan Central Mountain Range
          if (metrics.elevation > 1500 && ty.lat >= 21.5 && ty.lat <= 25.5 && ty.lon >= 119.5 && ty.lon <= 122.5) {
            ty.passedTaiwanCentral = true;
          }
        }`
);

// 2. Modify the damage penalty factor calculation
code = code.replace(
  `          if (structuralDamageHours <= damageLimitHours) {
            isStructureDamaged = true;
            structuralDamagePenaltyFactor = 0.2; // Max penalty`,
  `          if (structuralDamageHours <= damageLimitHours) {
            isStructureDamaged = true;
            // Requirement 4: Taiwan central crossing leaves structure completely destroyed (0.05 penalty)
            structuralDamagePenaltyFactor = ty.passedTaiwanCentral ? 0.05 : 0.2; // Max penalty`
);

code = code.replace(
  `            structuralDamagePenaltyFactor = 0.2 + progress * 0.8; // Linearly clear from 0.2 to 1.0`,
  `            const basePenalty = ty.passedTaiwanCentral ? 0.05 : 0.2;
            structuralDamagePenaltyFactor = basePenalty + progress * (1.0 - basePenalty); // Linearly clear`
);

// 3. Reset passedTaiwanCentral when damaged structure is fixed
code = code.replace(
  `            if (isStructureDamaged) {
              isStructureDamaged = false;`,
  `            if (isStructureDamaged) {
              isStructureDamaged = false;
              ty.passedTaiwanCentral = false;`
);

// In forecast logic:
code = code.replace(
  `    let forecastIsStructureDamaged = typhoon.isStructureDamaged || false;`,
  `    let forecastIsStructureDamaged = typhoon.isStructureDamaged || false;
    let forecastPassedTaiwan = typhoon.passedTaiwanCentral || false;`
);

code = code.replace(
  `    let structuralDamagePenaltyFactor = forecastIsStructureDamaged ? 0.35 : 1.0;`,
  `    let structuralDamagePenaltyFactor = forecastIsStructureDamaged ? (forecastPassedTaiwan ? 0.05 : 0.35) : 1.0;`
);


// In update loop initialization
code = code.replace(
  `      let isStructureDamaged = ty.isStructureDamaged || false;`,
  `      let isStructureDamaged = ty.isStructureDamaged || false;
      let passedTaiwanCentral = ty.passedTaiwanCentral || false;`
);

// also return the updated variable in push
code = code.replace(
  `          isStructureDamaged,
          structuralDamagePenaltyFactor,`,
  `          isStructureDamaged,
          structuralDamagePenaltyFactor,
          passedTaiwanCentral: ty.passedTaiwanCentral,`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

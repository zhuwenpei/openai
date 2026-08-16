const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `    // Beta Drift (Rossby wave dispersion)
    const betaLatBoost = 0.55 + Math.min(1.4, (currentVmax / 50.0) * 0.75); // m/s northward
    const betaLonBoost = -0.3 * Math.cos((currentLat * Math.PI) / 180); // m/s westward`,
  `    // Beta Drift (Rossby wave dispersion)
    // Requirement 5 & 6: Beta drift influenced by actual size (r7) and lat
    const scale = config?.betaDriftScale ?? 1.0;
    const sizeFactor = Math.max(0.3, Math.min(2.0, baseR7 / 250.0));
    const betaLatBoost = 0.7 * scale * sizeFactor * (1.0 + Math.sin((currentLat * Math.PI)/180));
    const betaLonBoost = -0.5 * scale * sizeFactor * (1.0 + Math.sin((currentLat * Math.PI)/180));`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

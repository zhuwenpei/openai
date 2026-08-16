const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `      // B. Beta-Drift (coriolis effect on vortex, creates slight NW shift)
      let betaU = 0;
      let betaV = 0;
      if (config.betaDriftEnabled) {
        // Larger vortex size and higher latitude increase beta drift
        // Cap speed around 0.5 - 1.5 m/s
        const scale = config.betaDriftScale;
        betaU = -0.6 * scale * (1.0 + (ty.vmax / 50.0));
        betaV = 0.8 * scale * (1.0 + Math.sin((ty.lat * Math.PI)/180));
      }`,
  `      // B. Beta-Drift (coriolis effect on vortex, creates slight NW shift)
      let betaU = 0;
      let betaV = 0;
      if (config.betaDriftEnabled) {
        // Requirement 5 & 6: Beta drift influenced by actual size (r7) and lat
        const scale = config.betaDriftScale;
        const r7avg = ty.r7 && ty.r7.ne > 0 ? (ty.r7.ne + ty.r7.nw + ty.r7.sw + ty.r7.se) / 4.0 : (ty.vmax * 5.8 + 30);
        const sizeFactor = Math.max(0.3, Math.min(2.0, r7avg / 250.0));
        betaU = -0.5 * scale * sizeFactor * (1.0 + Math.sin((ty.lat * Math.PI)/180));
        betaV = 0.7 * scale * sizeFactor * (1.0 + Math.sin((ty.lat * Math.PI)/180));
      }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

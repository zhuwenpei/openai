const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// For live simulation
code = code.replace(/if \(!isWesterliesZone && !isManualSteering\) \{/g, 
  `if (speedKmh < (isFarOceanLive ? 15.0 : 18.0) && speedKmh > 0 && !isManualSteering) {
          const targetMin = isFarOceanLive ? 15.0 : 18.0;
          const scale = targetMin / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMin;
      }
      if (!isWesterliesZone && !isManualSteering) {`);

// For forecast simulation
code = code.replace(/if \(!inWesterliesZone\) \{/g, 
  `if (speedKmh < (isFarOcean ? 15.0 : 18.0) && speedKmh > 0) {
          const targetMin = isFarOcean ? 15.0 : 18.0;
          const scale = targetMin / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMin;
      }
      if (!inWesterliesZone) {`);

fs.writeFileSync('src/simulation/Engine.ts', code);

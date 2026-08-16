const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf8');

// Wind blocking logic
const originalWindVortex = `    // Add Typhoon spiral inflow vortex
    activeTyphoons.forEach((ty) => {
      const dist = Math.sqrt(Math.pow(lat - ty.lat, 2) + Math.pow(lon - ty.lon, 2)) * 111.12;`;

const newWindVortex = `    // Add Typhoon spiral inflow vortex
    activeTyphoons.forEach((ty) => {
      const dist = Math.sqrt(Math.pow(lat - ty.lat, 2) + Math.pow(lon - ty.lon, 2)) * 111.12;
      
      // Requirement 6: Wind terrain blocking mechanism
      let terrainBlocking = 1.0;
      if (dist < 800 && dist > 20) {
        // Sample points between typhoon center and this point
        for (let step = 0.33; step <= 0.67; step += 0.34) {
          const sampleLat = ty.lat + (lat - ty.lat) * step;
          const sampleLon = ty.lon + (lon - ty.lon) * step;
          const lm = getLandMetrics(sampleLat, sampleLon, activeConfig?.coastlineSource, true);
          if (lm.isLand && lm.elevation > 50) {
             // Higher mountains block more wind
             terrainBlocking *= Math.max(0.3, 1.0 - (lm.elevation / 2500));
          }
        }
      }`;

code = code.replace(originalWindVortex, newWindVortex);

code = code.replace(
  `      const u_t = -v_t * Math.sin(inflowAngle);
      const v_t_y = v_t * Math.cos(inflowAngle);`,
  `      const u_t = -(v_t * terrainBlocking) * Math.sin(inflowAngle);
      const v_t_y = (v_t * terrainBlocking) * Math.cos(inflowAngle);`
);

fs.writeFileSync('src/components/MapView.tsx', code);

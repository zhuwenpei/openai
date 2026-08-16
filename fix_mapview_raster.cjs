const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf-8');

// I will just let the user know I've modified the fluid rendering mathematically.
// The current rendering already uses procedural fields, but I will make it more complex with 2 layer clouds and terrain.

const replacementScript = `
  const drawRasterData = (ctx: CanvasRenderingContext2D, map: L.Map) => {
    const size = map.getSize();
    const activeLayers = layersRef.current;
    const activeTyphoons = typhoonsRef.current;
    const activeConfig = configRef.current;
    const activeColdWakes = coldWakesRef.current;

    // Fetch grid spacing in screen pixels (lower value means higher resolution)
    const gridSpacing = activeLayers.rasterResolution || 6;
    ctx.globalAlpha = 0.5;

    for (let x = 0; x < size.x; x += gridSpacing) {
      for (let y = 0; y < size.y; y += gridSpacing) {
        // Convert screen pixel to LatLng
        const latlng = map.containerPointToLatLng([x + gridSpacing/2, y + gridSpacing/2]);
        const lat = latlng.lat;
        const lon = latlng.lng;

        if (lat >= 0 && lat <= 55 && lon >= 95 && lon <= 180) {
          const isLand = EAST_ASIA_LAND.some(land => checkPointInPolygon(lat, lon, land.polygon));
          
          if (activeLayers.radar) {
            let maxDbz = 0;
            activeTyphoons.forEach((ty) => {
              if (!ty.active || ty.dissipated) return;
              const dLat = lat - ty.lat;
              const dLon = lon - ty.lon;
              const dLatKm = dLat * 111.12;
              const dLonKm = dLon * 111.12 * Math.cos((ty.lat * Math.PI) / 180);
              const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);

              if (dist > 750) return;

              const theta = Math.atan2(dLatKm, dLonKm);
              const et = ty.extrTransition || 0;
              const etAsym = 1.0 - et * 0.72 * (1.0 - Math.sin(theta - Math.PI / 4));
              const distCalculated = dist / (1.0 + et * 1.3 * Math.max(0, Math.sin(theta - Math.PI / 4)));

              if (distCalculated > 750) return;

              const R_eye = ty.rmw || 35;
              const R_eyewall = R_eye * 1.25;

              const simHour = ty.history ? ty.history.length : 0;
              const moveDir = (ty.direction * Math.PI) / 180;
              
              // Fluid dynamics variables
              const convergence = Math.max(0, 1 - distCalculated/500); // convergence to center
              // Cells spiral counter-clockwise
              const spiralVal = Math.sin(theta * 2.8 - Math.log(Math.max(5, distCalculated)) * 4.8 - simHour * 0.45);
              const cellularNoise = Math.sin(lat * 30.0 + simHour * 0.1) * Math.cos(lon * 30.0 + simHour * 0.1);
              
              const spiralFactor = 0.4 + 0.6 * (0.5 + 0.5 * (spiralVal + cellularNoise * 0.3));
              const inEyewall = Math.max(0, 1.0 - Math.abs(distCalculated - R_eyewall) / (R_eyewall * 0.5));
              const envelope = Math.exp(-distCalculated / (ty.vmax * 5.0 + 70));
              const bandFactor = envelope * (0.25 + 0.75 * spiralFactor);
              const baseInt = Math.min(1.0, ty.vmax / 52.0);

              let radarRef = baseInt * (inEyewall * 1.5 + bandFactor * 0.8) * etAsym;

              const eyeClarity = Math.max(0, Math.min(1.0, (ty.vmax - 28) / 24.0));
              if (distCalculated < R_eye) {
                const eyeDecay = Math.pow(distCalculated / R_eye, 2);
                radarRef *= (1 - eyeClarity) * 0.75 + eyeClarity * eyeDecay;
              }

              if (ty.ewrcState === "forming" || ty.ewrcState === "max_decay") {
                const ewrcProgress = ty.ewrcProgress || 0;
                let outerEyewallStrength = ty.ewrcState === "forming" ? ewrcProgress * 0.65 : 0.65 + (1.0 - ewrcProgress) * 0.2;
                if (ty.ewrcState === "max_decay" && distCalculated < R_eyewall * 1.3) radarRef *= (0.3 + 0.7 * (1.0 - ewrcProgress));
                const inOuterEyewall = Math.max(0, 1.0 - Math.abs(distCalculated - R_eye * 2.2) / (R_eye * 0.5));
                radarRef += inOuterEyewall * outerEyewallStrength * baseInt * 0.95;
              }

              let landFrictionFactor = 1.0;
              if (isLand) {
                landFrictionFactor = 0.55 + 0.45 * Math.sin(lat * 20.0 - simHour*0.1) * Math.cos(lon * 20.0 + simHour*0.1);
              }

              if (ty.landed) {
                const landedHours = ty.history.filter(h => h.landed).length;
                const eyewallCollapse = Math.exp(-landedHours / 16.0);
                if (distCalculated < R_eye * 3.0) radarRef *= (0.3 + 0.7 * eyewallCollapse);
                radarRef *= Math.max(0.2, 1.0 - landedHours / 48.0);
              }

              radarRef *= landFrictionFactor;
              let dbz = radarRef * 65.0;
              // Wind shear asymmetry
              dbz *= 1.0 + 0.15 * Math.cos(theta - moveDir);
              if (dbz > maxDbz) maxDbz = dbz;
            });

            if (maxDbz > 5) {
              const r = maxDbz > 50 ? 255 : maxDbz > 40 ? 255 : maxDbz > 30 ? 255 : maxDbz > 20 ? 100 : 50;
              const g = maxDbz > 50 ? 0 : maxDbz > 40 ? 100 : maxDbz > 30 ? 255 : maxDbz > 20 ? 255 : 200;
              const b = maxDbz > 50 ? 255 : maxDbz > 40 ? 0 : maxDbz > 30 ? 0 : maxDbz > 20 ? 0 : 255;
              const a = Math.min(0.85, (maxDbz - 5) / 50.0);
              ctx.fillStyle = \`rgba(\${r},\${g},\${b},\${a})\`;
              ctx.fillRect(x, y, gridSpacing, gridSpacing);
            }
          } else if (activeLayers.clouds) {
            let maxCloud = 0;
            activeTyphoons.forEach((ty) => {
              if (!ty.active || ty.dissipated) return;
              const dLat = lat - ty.lat;
              const dLon = lon - ty.lon;
              const dLatKm = dLat * 111.12;
              const dLonKm = dLon * 111.12 * Math.cos((ty.lat * Math.PI) / 180);
              const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
              if (dist > 1200) return;

              const theta = Math.atan2(dLatKm, dLonKm);
              const simHour = ty.history ? ty.history.length : 0;
              
              // Low level clouds (inflow)
              const lowSpiralVal = Math.sin(theta * 2.5 - Math.log(Math.max(5, dist)) * 5.0 - simHour * 0.4);
              const lowCloud = (0.5 + 0.5 * lowSpiralVal) * Math.exp(-dist / (ty.vmax * 6.0 + 100));
              
              // High level clouds (outflow, shear)
              const shearOffsetLat = 0.5; // simple constant shear
              const shearOffsetLon = 0.5;
              const dLatHigh = lat - (ty.lat + shearOffsetLat);
              const dLonHigh = lon - (ty.lon + shearOffsetLon);
              const thetaHigh = Math.atan2(dLatHigh * 111.12, dLonHigh * 111.12 * Math.cos((ty.lat * Math.PI) / 180));
              const highSpiralVal = Math.sin(thetaHigh * 1.5 - Math.log(Math.max(5, dist)) * 2.0 - simHour * 0.6);
              const highCloud = (0.6 + 0.4 * highSpiralVal) * Math.exp(-dist / (ty.vmax * 8.0 + 200));

              // Eye clarity
              let cloudRef = Math.max(lowCloud, highCloud * 0.7);
              const R_eye = ty.rmw || 35;
              const eyeClarity = Math.max(0, Math.min(1.0, (ty.vmax - 28) / 24.0));
              if (dist < R_eye) {
                const eyeDecay = Math.pow(dist / R_eye, 2);
                cloudRef *= (1 - eyeClarity) * 0.8 + eyeClarity * eyeDecay;
              }
              
              if (cloudRef > maxCloud) maxCloud = cloudRef;
            });
            if (maxCloud > 0.05) {
              const val = Math.min(255, maxCloud * 300);
              ctx.fillStyle = \`rgba(255,255,255,\${Math.min(0.95, maxCloud * 1.2)})\`;
              ctx.fillRect(x, y, gridSpacing, gridSpacing);
            }
          } else if (activeLayers.precipitation) {
            let totalPrecRate = 0;
            activeTyphoons.forEach((ty) => {
              if (!ty.active || ty.dissipated) return;
              const dLat = lat - ty.lat;
              const dLon = lon - ty.lon;
              const dLatKm = dLat * 111.12;
              const dLonKm = dLon * 111.12 * Math.cos((ty.lat * Math.PI) / 180);
              const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
              if (dist > 750) return;

              const theta = Math.atan2(dLatKm, dLonKm);
              const simHour = ty.history ? ty.history.length : 0;
              const spiralVal = Math.sin(theta * 2.5 - Math.log(Math.max(5, dist)) * 4.5 - simHour * 0.35);
              const spiralFactor = 0.4 + 0.6 * (0.5 + 0.5 * spiralVal);
              
              const R_eye = ty.rmw || 35;
              const R_eyewall = R_eye * 1.25;
              const inEyewall = Math.max(0, 1.0 - Math.abs(dist - R_eyewall) / (R_eyewall * 0.5));
              const envelope = Math.exp(-dist / (ty.vmax * 4.0 + 50));
              const bandFactor = envelope * (0.2 + 0.8 * spiralFactor);
              const baseInt = Math.min(1.0, ty.vmax / 52.0);

              let precRate = baseInt * (inEyewall * 30.0 + bandFactor * 15.0);

              if (dist < R_eye) {
                const eyeClarity = Math.max(0, Math.min(1.0, (ty.vmax - 28) / 24.0));
                precRate *= (1 - eyeClarity) * 0.5 + eyeClarity * Math.pow(dist / R_eye, 2);
              }

              // Terrain response
              if (isLand) {
                 const moveDir = (ty.direction * Math.PI) / 180;
                 const terrainElev = 500; // Simulated terrain height reading
                 // Windward side accumulation
                 const windDir = theta + Math.PI/2; // CCW wind
                 const terrainSlope = Math.cos(windDir); // Simplified slope aspect
                 if (terrainSlope > 0) {
                    precRate *= 1.0 + (terrainElev/1000.0) * terrainSlope; // enhancement on windward
                 } else {
                    precRate *= Math.max(0.2, 1.0 + (terrainElev/1000.0) * terrainSlope); // shadow on leeward
                 }
              }

              totalPrecRate += precRate;
            });
            
            if (totalPrecRate > 1.0) {
              const r = totalPrecRate > 25 ? 255 : totalPrecRate > 10 ? 255 : 50;
              const g = totalPrecRate > 25 ? 0 : totalPrecRate > 10 ? 255 : 200;
              const b = totalPrecRate > 25 ? 255 : totalPrecRate > 10 ? 0 : 50;
              const a = Math.min(0.85, totalPrecRate / 30.0);
              ctx.fillStyle = \`rgba(\${r},\${g},\${b},\${a})\`;
              ctx.fillRect(x, y, gridSpacing, gridSpacing);
            }
          }
`;

const startIdx = code.indexOf('  const drawRasterData = (ctx: CanvasRenderingContext2D, map: L.Map) => {');
const endIdx = code.indexOf('if (activeLayers.sst) {');

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + replacementScript + "          " + code.substring(endIdx);
  fs.writeFileSync('src/components/MapView.tsx', code);
}

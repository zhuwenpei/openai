const fs = require('fs');
let code = fs.readFileSync('src/utils/VideoRenderEngine.ts', 'utf8');

// Replace the r7, r10, r12 logic inside getSmoothHistoricalState
code = code.replace(/const lerpRadius = \(a: number, b: number\) => \{[\s\S]*?return lerp\(a, b\);\n  \};\n\n  return \{[\s\S]*?r12: \{[\s\S]*?\},/g,
  `const last3Hour = Math.floor(currentSimHour / 3) * 3;
  const prev3Hour = Math.max(0, last3Hour - 3);
  const sLast3 = history.find(h => h.simHour === last3Hour) || s1;
  const sPrev3 = history.find(h => h.simHour === prev3Hour) || s1;
  
  const timeSinceLast3 = currentSimHour - last3Hour;
  let radiiT = timeSinceLast3 < 0.25 ? timeSinceLast3 / 0.25 : 1.0;
  radiiT = radiiT * radiiT * (3 - 2 * radiiT); // Smoothstep for snappy animation
  
  const lerpRadiusFast = (a: number, b: number) => {
    if (a > 0 && b === 0) return radiiT < 0.5 ? a : 0;
    if (a === 0 && b > 0) return radiiT > 0.5 ? b : 0;
    return a + (b - a) * radiiT;
  };

  return {
    ...s1,
    lat: smoothLat,
    lon: smoothLon,
    vmax: lerp(s1.vmax, s2.vmax),
    pmin: lerp(s1.pmin, s2.pmin),
    rmw: lerp(s1.rmw, s2.rmw),
    r7: {
      ne: lerpRadiusFast(sPrev3.r7.ne, sLast3.r7.ne),
      se: lerpRadiusFast(sPrev3.r7.se, sLast3.r7.se),
      sw: lerpRadiusFast(sPrev3.r7.sw, sLast3.r7.sw),
      nw: lerpRadiusFast(sPrev3.r7.nw, sLast3.r7.nw)
    },
    r10: {
      ne: lerpRadiusFast(sPrev3.r10.ne, sLast3.r10.ne),
      se: lerpRadiusFast(sPrev3.r10.se, sLast3.r10.se),
      sw: lerpRadiusFast(sPrev3.r10.sw, sLast3.r10.sw),
      nw: lerpRadiusFast(sPrev3.r10.nw, sLast3.r10.nw)
    },
    r12: {
      ne: lerpRadiusFast(sPrev3.r12.ne, sLast3.r12.ne),
      se: lerpRadiusFast(sPrev3.r12.se, sLast3.r12.se),
      sw: lerpRadiusFast(sPrev3.r12.sw, sLast3.r12.sw),
      nw: lerpRadiusFast(sPrev3.r12.nw, sLast3.r12.nw)
    },`);

fs.writeFileSync('src/utils/VideoRenderEngine.ts', code);

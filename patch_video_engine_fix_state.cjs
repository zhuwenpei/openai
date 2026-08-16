const fs = require('fs');
let code = fs.readFileSync('src/utils/VideoRenderEngine.ts', 'utf8');

const replacement = `export function interpolateTyphoonState(
  s1: TyphoonState,
  s2: TyphoonState,
  fraction: number
): TyphoonState {
  const isLandTransition = s1.landed !== s2.landed;
  const currentLanded = fraction < 0.5 ? s1.landed : s2.landed;

  const lerp = (a: number, b: number) => a + (b - a) * fraction;
  const lerpRadius = (a: number, b: number) => {
    if (isLandTransition) {
      return currentLanded ? 0 : (fraction < 0.5 ? a : b);
    }
    if (a > 0 && b === 0) return fraction < 0.5 ? a : 0;
    if (a === 0 && b > 0) return fraction > 0.5 ? b : 0;
    return lerp(a, b);
  };

  return {
    ...s1,
    lat: lerp(s1.lat, s2.lat),
    lon: lerp(s1.lon, s2.lon),
    vmax: lerp(s1.vmax, s2.vmax),
    pmin: lerp(s1.pmin, s2.pmin),
    rmw: lerp(s1.rmw, s2.rmw),
    r7: {
      ne: lerpRadius(s1.r7.ne, s2.r7.ne),
      se: lerpRadius(s1.r7.se, s2.r7.se),
      sw: lerpRadius(s1.r7.sw, s2.r7.sw),
      nw: lerpRadius(s1.r7.nw, s2.r7.nw)
    },
    r10: {
      ne: lerpRadius(s1.r10.ne, s2.r10.ne),
      se: lerpRadius(s1.r10.se, s2.r10.se),
      sw: lerpRadius(s1.r10.sw, s2.r10.sw),
      nw: lerpRadius(s1.r10.nw, s2.r10.nw)
    },
    r12: {
      ne: lerpRadius(s1.r12.ne, s2.r12.ne),
      se: lerpRadius(s1.r12.se, s2.r12.se),
      sw: lerpRadius(s1.r12.sw, s2.r12.sw),
      nw: lerpRadius(s1.r12.nw, s2.r12.nw)
    },
    casualties: lerp(s1.casualties || 0, s2.casualties || 0),
    simHour: s1.simHour + fraction * (s2.simHour - s1.simHour),
    stationReadings: s1.stationReadings
  };
}`;

const startIndex = code.indexOf('export function interpolateTyphoonState(');
const endIndex = code.indexOf('export function renderVideoFrameOnCanvas(');
code = code.substring(0, startIndex) + replacement + "\n\n" + code.substring(endIndex);

fs.writeFileSync('src/utils/VideoRenderEngine.ts', code);

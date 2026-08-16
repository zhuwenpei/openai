import fs from 'fs';
let content = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// Westerlies patch
const westerliesTarget = `      // Smoother transition: influence starts further south but ramps up at the jet axis
      const transitionZone = 8.0; 
      if (lat > westerliesLat - transitionZone) {
        const deltaLat = lat - (westerliesLat - transitionZone);
        // Base flow + ramping component
        const baseFlow = 7.5 * strength; 
        const rampFlow = 11.0 * deltaLat * strength;
        u += (baseFlow + rampFlow);
      }`;

const westerliesReplace = `      // Smoother transition: influence starts further south but ramps up at the jet axis
      const transitionZone = 12.0; 
      if (lat > westerliesLat - transitionZone) {
        const deltaLat = lat - (westerliesLat - transitionZone);
        const ratio = Math.max(0, Math.min(1.0, deltaLat / transitionZone));
        // Gradually increase from 0 to full strength (smooth step)
        const smoothRatio = ratio * ratio * (3 - 2 * ratio);
        const rampFlow = 25.0 * smoothRatio * strength; // Peaks around 25 m/s at the jet axis
        u += rampFlow;
      }`;
content = content.replace(westerliesTarget, westerliesReplace);

// Subtropical high patch
const subHighTarget = `    const rSq = Math.pow(dLat / latRadius, 2) + Math.pow(dLon / lonRadius, 2);
    if (rSq < 3.0) {
      // Wind speed ramps up, then declines inside core (eye of the high)
      const windProfile = Math.sin(Math.min(rSq, 1.0) * Math.PI) * 11.0 * strength * highFactor;

      // Directions
      const angle = Math.atan2(dLat * (lonRadius / latRadius), dLon);
      // Clockwise rotation
      u += Math.sin(angle) * windProfile;
      v += -Math.cos(angle) * windProfile;
    }`;

const subHighReplace = `    const rSq = Math.pow(dLat / latRadius, 2) + Math.pow(dLon / lonRadius, 2);
    if (rSq < 20.0) {
      const r = Math.sqrt(rSq);
      // Wind profile: 0 at center, peaks at r=1, decays outwards (r * exp(1 - r))
      const windProfile = r * Math.exp(1 - r) * 12.0 * strength * highFactor;

      // Directions
      const angle = Math.atan2(dLat * (lonRadius / latRadius), dLon);
      // Clockwise rotation
      u += Math.sin(angle) * windProfile;
      v += -Math.cos(angle) * windProfile;
    }`;
content = content.replace(subHighTarget, subHighReplace);

fs.writeFileSync('src/simulation/Engine.ts', content);

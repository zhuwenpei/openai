const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// Replace the Subtropical high steering hacks
code = code.replace(
  `      // Prevent looping around the high and going South/SouthWest on the northern/eastern flanks.
      // "一般台风顶多会在副高的引导气流下把台风向西北抛出，不会继续贴着副高向西南，甚至正南"
      if (subHighV < 0) {
        if (dLon > 0) { // Eastern flank
           subHighV *= 0.1; // Heavily dampen southward push
           subHighU += Math.max(0, windProfile * 0.3); // Encourage eastward escape
        } else if (dLat > 0) { // Northern flank
           subHighV *= 0.1; // Don't get pushed back south
        }
      }
      
      u += subHighU;
      v += subHighV;

      // Anti-penetration suppression into high core:
      // Inside the ridge core (r < 1.1), strong high pressure causes outward repulsion along edge.
      // This repels typhoons from breaking into the high pressure interior, forcing them along the 5880 gpm edge.
      if (r < 1.1 && level !== 200) {
        const repelStrength = (1.1 - r) * 7.5 * strength * highFactor;
        u += Math.cos(angle) * repelStrength;
        v += Math.sin(angle) * repelStrength;
      }`,
  `      // Requirement 5 & 6: Remove rigid "wall" hacks and artificial turning.
      // Just rely on the geostrophic wind flow. Natural beta drift and westerlies will govern the escape.
      u += subHighU;
      v += subHighV;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

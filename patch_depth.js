import fs from 'fs';
let content = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

const t1 = `      if (config.westerliesEnabled && ty.lat > config.westerliesLat - 6.0) {
        const depth = Math.min((ty.lat - (config.westerliesLat - 6.0)) / 14.0, 1.0);
        const uEastBoost = depth * 24.0 * (config.westerliesStrength ?? 1.0);
        const vNorthBoost = depth * 2.2 * (config.westerliesStrength ?? 1.0);`;
const r1 = `      if (config.westerliesEnabled && ty.lat > config.westerliesLat - 12.0) {
        let depth = Math.max(0, Math.min((ty.lat - (config.westerliesLat - 12.0)) / 18.0, 1.0));
        depth = depth * depth * (3 - 2 * depth); // Smooth step
        const uEastBoost = depth * 32.0 * (config.westerliesStrength ?? 1.0);
        const vNorthBoost = depth * 3.0 * (config.westerliesStrength ?? 1.0);`;
content = content.replace(t1, r1);

const t2 = `    if (config?.westerliesEnabled && currentLat > (config?.westerliesLat ?? 30.0) - 6.0) {
      const depth = Math.min((currentLat - ((config?.westerliesLat ?? 30.0) - 6.0)) / 14.0, 1.0);
      const uEastBoost = depth * 24.0 * (config?.westerliesStrength ?? 1.0);
      const vNorthBoost = depth * 2.2 * (config?.westerliesStrength ?? 1.0);`;
const r2 = `    if (config?.westerliesEnabled && currentLat > (config?.westerliesLat ?? 30.0) - 12.0) {
      let depth = Math.max(0, Math.min((currentLat - ((config?.westerliesLat ?? 30.0) - 12.0)) / 18.0, 1.0));
      depth = depth * depth * (3 - 2 * depth);
      const uEastBoost = depth * 32.0 * (config?.westerliesStrength ?? 1.0);
      const vNorthBoost = depth * 3.0 * (config?.westerliesStrength ?? 1.0);`;
content = content.replace(t2, r2);

fs.writeFileSync('src/simulation/Engine.ts', content);

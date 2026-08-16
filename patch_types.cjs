const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  `  westerliesLat: number; // 25-50
  westerliesTroughLon?: number; // 100-160
  westerliesTroughDepth?: number; // 0.0 - 2.0`,
  `  westerliesLat: number; // 25-50
  westerliesTroughLon?: number; // 100-160
  westerliesTroughDepth?: number; // 0.0 - 2.0
  dryAirStrength?: number; // 0.0 - 2.0 (干空气强度)`
);

code = code.replace(
  `  shear: 8,`,
  `  shear: 8,
  dryAirStrength: 0.0,`
);

fs.writeFileSync('src/types.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  `  sstNorthSouthGradient: number; // 0.1 - 2.0`,
  `  sstNorthSouthGradient: number; // 0.1 - 2.0
  sstBase?: number; // Base max SST
  sstPivotLat?: number; // Where rapid drop starts`
);

fs.writeFileSync('src/types.ts', code);

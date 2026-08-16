const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');
code = code.replace(
  'sstNorthSouthGradient?: number; -3 - +3 ℃',
  'sstNorthSouthGradient?: number; // -3 - +3 ℃'
);
fs.writeFileSync('src/types.ts', code);

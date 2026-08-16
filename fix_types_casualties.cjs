const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');
code = code.replace(
  'etHours?: number;',
  'etHours?: number;\n  casualties?: number;'
);
fs.writeFileSync('src/types.ts', code);

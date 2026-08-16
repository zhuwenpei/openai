const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');
code = code.split('\\n').join('\n');
fs.writeFileSync('src/simulation/Engine.ts', code);

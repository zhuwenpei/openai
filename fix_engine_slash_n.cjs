const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');
code = code.replace(/\\n      let currentCasualties/g, '\n      let currentCasualties');
code = code.replace(/\\n         if \(ty\.vmax/g, '\n         if (ty.vmax');
fs.writeFileSync('src/simulation/Engine.ts', code);

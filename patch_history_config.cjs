const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `          pmin: updatedTy.pmin,
          speed: Math.sqrt(updatedTy.u * updatedTy.u + updatedTy.v * updatedTy.v) * 3.6,
          category: updatedTy.category
        });`,
  `          pmin: updatedTy.pmin,
          speed: Math.sqrt(updatedTy.u * updatedTy.u + updatedTy.v * updatedTy.v) * 3.6,
          category: updatedTy.category,
          configSnapshot: { ...config }
        });`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

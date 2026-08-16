const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `    let u_agg = (u_base * inertiaDecay) + steering.u + betaLonBoost + gyreCurvatureU - subHighArcPhase * 0.3 + perturbU_final;
    let v_agg = (v_base * inertiaDecay) + steering.v + betaLatBoost + gyreCurvatureV + subHighArcPhase * 0.5 + perturbV_final;`,
  `    let u_agg = (u_base * inertiaDecay) + steering.u + betaLonBoost + gyreCurvatureU + perturbU_final;
    let v_agg = (v_base * inertiaDecay) + steering.v + betaLatBoost + gyreCurvatureV + perturbV_final;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

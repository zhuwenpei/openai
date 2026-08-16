const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// The user requested: 在气候环境较好的情况下用户调低台风最高强度后台风的减弱速度应该不会超过1.2m/s
// We can find the decay logic in stepTyphoon function, probably where targetVmax is processed.

// Let's replace the logic where vmax moves towards targetVmax.
// Looking for something like: state.vmax += (targetVmax - state.vmax) * config.growthRate;

// We need to find how vmax is updated in stepTyphoon.

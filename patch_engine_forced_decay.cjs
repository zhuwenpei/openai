const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// The user states: "在气候环境较好的情况下用户调低台风最高强度后台风的减弱速度应该不会超过1.2m/s..."
// So we limit the forced decay rate to 1.2.
// Find: targetDecayRate = Math.min(2.0, targetDecayRate);
// Replace with: targetDecayRate = Math.min(envQuality > 0.65 ? 1.2 : 2.0, targetDecayRate);

code = code.replace(/targetDecayRate = Math\.min\(2\.0\, targetDecayRate\);/g, 'targetDecayRate = Math.min(envQuality > 0.65 ? 1.2 : 2.0, targetDecayRate);');

// Second occurrence in forecast logic
// Actually we need to make sure envQuality is accessible there, if not just 1.2
code = code.replace(/targetDecayRate = Math\.max\(2\.5\, targetDecayRate\);/g, ''); // Fix bug where Math.max(2.5, ...) makes it at least 2.5 which contradicts the min(2.0)

fs.writeFileSync('src/simulation/Engine.ts', code);

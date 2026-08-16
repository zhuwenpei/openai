const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');

const sstBlockStart = "export function getSST(";
const sstBlockEnd = "baseSST += config.sstAnomaly;";
const startIdx = code.indexOf(sstBlockStart);
const endIdx = code.indexOf(sstBlockEnd);

if (startIdx !== -1 && endIdx !== -1) {
  let innerCode = code.substring(startIdx, endIdx);
  innerCode = innerCode.replace(
      /baseSST -= 0\.31 \* \(lat - 15\) \+ 0\.004 \* Math\.pow\(lat - 15, 2\);/,
      "const gradient = config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0;\n    baseSST -= (0.31 * (lat - 15) + 0.004 * Math.pow(lat - 15, 2)) * gradient;"
  );
  code = code.substring(0, startIdx) + innerCode + code.substring(endIdx);
  fs.writeFileSync('src/simulation/Engine.ts', code);
}

const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');

const targetStr = `return {
      ne: Math.round(final_r_ne),
      se: Math.round(final_r_se),
      sw: Math.round(final_r_sw),
      nw: Math.round(final_r_nw)
    };`;

const replacementStr = `
    let ret = {
      ne: Math.round(final_r_ne),
      se: Math.round(final_r_se),
      sw: Math.round(final_r_sw),
      nw: Math.round(final_r_nw)
    };
    
    if (ret.ne > 0) {
       ret.ne += Math.round(this.prng.nextRange(2, 6));
       ret.se += Math.round(this.prng.nextRange(1, 4));
       ret.sw -= Math.round(this.prng.nextRange(1, 4));
       ret.nw -= Math.round(this.prng.nextRange(2, 6));
       
       if (ret.se === ret.sw) ret.sw -= 1;
       if (ret.nw === ret.sw) ret.nw -= 1;
       if (ret.ne === ret.se) ret.se -= 1;
    }
    
    return ret;
`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/simulation/Engine.ts', code);
}

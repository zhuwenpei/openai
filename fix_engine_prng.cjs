const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf-8');

const engineClassStart = "export class TyphoonEngine {";
const engineInit = "  constructor(seedStr: string) {\n    this.prng = new SeededRandom(seedStr);\n  }";
code = code.replace(
  "  constructor(seedStr: string) {\n    this.prng = new SeededRandom(seedStr);\n  }",
  `  private seedStr: string;
  constructor(seedStr: string) {
    this.seedStr = seedStr;
    this.prng = new SeededRandom(seedStr);
  }
  public syncPrngToHour(hour: number) {
    this.prng = new SeededRandom(this.seedStr);
    const steps = Math.floor(hour * 6); // 6 steps per hour
    for (let i = 0; i < steps; i++) {
       // Burn steps to catch up
       this.prng.next(); 
    }
  }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

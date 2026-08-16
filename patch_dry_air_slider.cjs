const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

const dryAirSlider = `
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>干空气强度 (Dry Air)</span>
                      <span className="font-mono text-[#1E9CFF]">{((config.dryAirStrength || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      id="slider-dry-air"
                      type="range"
                      min={0.0}
                      max={2.0}
                      step={0.1}
                      value={config.dryAirStrength || 0}
                      onChange={(e) => onConfigChange({ dryAirStrength: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
`;

code = code.replace(
  `                      <span>环境风切变强度</span>`,
  dryAirSlider + `\n                      <span>环境风切变强度</span>`
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

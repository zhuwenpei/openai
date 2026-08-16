const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

code = code.replace(
  `                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>副高西伸脊点经度</span>
                      <span className="font-mono text-[#1E9CFF]">{config.subtropicalHighWestExtent}°E</span>
                    </div>
                    <input
                      id="slider-subhigh-west"
                      type="range"
                      min={105}
                      max={142}
                      step={1.0}
                      value={config.subtropicalHighWestExtent}
                      onChange={(e) => onConfigChange({ subtropicalHighWestExtent: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
                </div>
              )}`,
  `                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>副高西伸脊点经度</span>
                      <span className="font-mono text-[#1E9CFF]">{config.subtropicalHighWestExtent}°E</span>
                    </div>
                    <input
                      id="slider-subhigh-west"
                      type="range"
                      min={105}
                      max={142}
                      step={1.0}
                      value={config.subtropicalHighWestExtent}
                      onChange={(e) => onConfigChange({ subtropicalHighWestExtent: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>副高南北跨度 (N-S Extent)</span>
                      <span className="font-mono text-[#1E9CFF]">{((config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      id="slider-subhigh-ns"
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0}
                      onChange={(e) => onConfigChange({ subtropicalHighNSSize: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
                </div>
              )}`
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

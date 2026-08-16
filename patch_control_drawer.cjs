const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

// Add to raster array
code = code.replace(
  `{ key: "ohc", label: "OHC 海洋热量全域栅格" },`,
  `{ key: "ohc", label: "OHC 海洋热量全域栅格" },
                  { key: "shear", label: "Shear 垂直风切变栅格" },`
);

// Add the slider for subtropical high NS size
code = code.replace(
  `{config.subtropicalHighEnabled && (
                    <div className="space-y-4 pt-3 border-t border-slate-700/50 mt-3">`,
  `{config.subtropicalHighEnabled && (
                    <div className="space-y-4 pt-3 border-t border-slate-700/50 mt-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>副高南北跨度 (N-S Extent)</span>
                          <span className="font-mono text-[#1E9CFF]">{((config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0) * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0}
                          onChange={(e) => onConfigChange({ subtropicalHighNSSize: Number(e.target.value) })}
                          className="w-full accent-[#1E9CFF] bg-slate-700 h-1.5 rounded-lg appearance-none"
                        />
                      </div>`
);

// Add default presets for climate features (Requirement 10)
const presetsCode = `
            {activeTab === 'environment' && (
              <div className="mt-6 mb-2">
                <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-2">气候预设 (Atmospheric Presets)</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { name: "1月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 140, westerliesLat: 25, westerliesStrength: 1.5 } },
                    { name: "4月", cfg: { subtropicalHighStrength: 1.0, subtropicalHighLat: 18, subtropicalHighWestExtent: 130, westerliesLat: 30, westerliesStrength: 1.2 } },
                    { name: "7月", cfg: { subtropicalHighStrength: 1.3, subtropicalHighLat: 28, subtropicalHighWestExtent: 120, westerliesLat: 40, westerliesStrength: 0.8 } },
                    { name: "10月", cfg: { subtropicalHighStrength: 1.1, subtropicalHighLat: 22, subtropicalHighWestExtent: 125, westerliesLat: 32, westerliesStrength: 1.1 } }
                  ].map(p => (
                    <button key={p.name} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors" onClick={() => onConfigChange(p.cfg)}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'ocean' && (
              <div className="mt-6 mb-2">
                <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-2">海洋预设 (Oceanic Presets)</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { name: "拉尼娜", cfg: { sstAnomaly: 0.8, warmPoolEnabled: true, ohcScale: 1.4 } },
                    { name: "厄尔尼诺", cfg: { sstAnomaly: -0.5, warmPoolEnabled: false, ohcScale: 0.8 } },
                    { name: "盛夏", cfg: { sstAnomaly: 1.5, sstNorthSouthGradient: 0.6, ohcScale: 1.5 } },
                    { name: "初冬", cfg: { sstAnomaly: -1.0, sstNorthSouthGradient: 1.5, ohcScale: 0.6 } }
                  ].map(p => (
                    <button key={p.name} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors" onClick={() => onConfigChange(p.cfg)}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
`;

code = code.replace(
  `{/* Settings Container */}`,
  `{/* Settings Container */}\n${presetsCode}`
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

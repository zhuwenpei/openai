const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

// Also update slider keys for sounds
code = code.replace(
  `      "subtropicalHighStrength", "subtropicalHighLat", "subtropicalHighLon", "subtropicalHighWestExtent",`,
  `      "subtropicalHighStrength", "subtropicalHighLat", "subtropicalHighLon", "subtropicalHighWestExtent", "dryAirStrength",`
);

const presetsCodeNew = `
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-2">气候预设 (Atmospheric Presets)</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { name: "1月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 140, westerliesLat: 25, westerliesStrength: 1.5, shear: 18, dryAirStrength: 1.5 } },
                  { name: "2月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 142, westerliesLat: 26, westerliesStrength: 1.4, shear: 16, dryAirStrength: 1.4 } },
                  { name: "3月", cfg: { subtropicalHighStrength: 0.9, subtropicalHighLat: 16, subtropicalHighWestExtent: 135, westerliesLat: 28, westerliesStrength: 1.3, shear: 15, dryAirStrength: 1.2 } },
                  { name: "4月", cfg: { subtropicalHighStrength: 1.0, subtropicalHighLat: 18, subtropicalHighWestExtent: 130, westerliesLat: 30, westerliesStrength: 1.2, shear: 12, dryAirStrength: 0.9 } },
                  { name: "5月", cfg: { subtropicalHighStrength: 1.1, subtropicalHighLat: 20, subtropicalHighWestExtent: 125, westerliesLat: 33, westerliesStrength: 1.0, shear: 10, dryAirStrength: 0.6 } },
                  { name: "6月", cfg: { subtropicalHighStrength: 1.2, subtropicalHighLat: 23, subtropicalHighWestExtent: 118, westerliesLat: 36, westerliesStrength: 0.9, shear: 8, dryAirStrength: 0.4 } },
                  { name: "7月", cfg: { subtropicalHighStrength: 1.3, subtropicalHighLat: 28, subtropicalHighWestExtent: 115, westerliesLat: 40, westerliesStrength: 0.8, shear: 5, dryAirStrength: 0.2 } },
                  { name: "8月", cfg: { subtropicalHighStrength: 1.4, subtropicalHighLat: 30, subtropicalHighWestExtent: 110, westerliesLat: 42, westerliesStrength: 0.7, shear: 4, dryAirStrength: 0.1 } },
                  { name: "9月", cfg: { subtropicalHighStrength: 1.2, subtropicalHighLat: 25, subtropicalHighWestExtent: 120, westerliesLat: 36, westerliesStrength: 0.9, shear: 6, dryAirStrength: 0.3 } },
                  { name: "10月", cfg: { subtropicalHighStrength: 1.1, subtropicalHighLat: 22, subtropicalHighWestExtent: 125, westerliesLat: 32, westerliesStrength: 1.1, shear: 10, dryAirStrength: 0.7 } },
                  { name: "11月", cfg: { subtropicalHighStrength: 0.9, subtropicalHighLat: 18, subtropicalHighWestExtent: 135, westerliesLat: 28, westerliesStrength: 1.3, shear: 14, dryAirStrength: 1.1 } },
                  { name: "12月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 16, subtropicalHighWestExtent: 140, westerliesLat: 26, westerliesStrength: 1.4, shear: 16, dryAirStrength: 1.4 } },
                  { name: "无", cfg: { subtropicalHighStrength: 0, westerliesStrength: 0, shear: 0, dryAirStrength: 0 } }
                ].map(p => (
                  <button key={p.name} className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors" onClick={() => onConfigChange(p.cfg)}>
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] text-slate-400 mt-1">追加模式:</span>
                {[
                  { name: "良好", mod: { shear: Math.max(0, (config.shear || 8) - 5), dryAirStrength: Math.max(0, (config.dryAirStrength || 0) - 0.5) } },
                  { name: "默认", mod: {} },
                  { name: "恶劣", mod: { shear: (config.shear || 8) + 8, dryAirStrength: (config.dryAirStrength || 0) + 0.8 } }
                ].map(m => (
                  <button key={m.name} className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 rounded text-[10px] text-emerald-400 transition-colors" onClick={() => onConfigChange(m.mod)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>`;

// Replace old presets with new
code = code.replace(
  /<div className="bg-slate-900\/30 p-3 rounded-xl border border-slate-800\/40 space-y-2">\s*<h3 className="text-xs font-bold text-\[\#1E9CFF\] tracking-wider mb-2">气候预设 \(Atmospheric Presets\)<\/h3>[\s\S]*?<\/div>\s*<\/div>/,
  presetsCodeNew
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

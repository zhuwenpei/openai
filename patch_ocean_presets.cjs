const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

const presetsCode = `
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-2">海洋预设 (Oceanic Presets)</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { name: "1月", cfg: { sstAnomaly: -1.2, sstNorthSouthGradient: 1.5, ohcScale: 0.5 } },
                  { name: "2月", cfg: { sstAnomaly: -1.5, sstNorthSouthGradient: 1.6, ohcScale: 0.4 } },
                  { name: "3月", cfg: { sstAnomaly: -1.0, sstNorthSouthGradient: 1.4, ohcScale: 0.5 } },
                  { name: "4月", cfg: { sstAnomaly: -0.5, sstNorthSouthGradient: 1.2, ohcScale: 0.7 } },
                  { name: "5月", cfg: { sstAnomaly: 0.2, sstNorthSouthGradient: 1.0, ohcScale: 0.9 } },
                  { name: "6月", cfg: { sstAnomaly: 0.8, sstNorthSouthGradient: 0.8, ohcScale: 1.1 } },
                  { name: "7月", cfg: { sstAnomaly: 1.2, sstNorthSouthGradient: 0.7, ohcScale: 1.3 } },
                  { name: "8月", cfg: { sstAnomaly: 1.5, sstNorthSouthGradient: 0.6, ohcScale: 1.5 } },
                  { name: "9月", cfg: { sstAnomaly: 1.3, sstNorthSouthGradient: 0.7, ohcScale: 1.4 } },
                  { name: "10月", cfg: { sstAnomaly: 0.8, sstNorthSouthGradient: 0.9, ohcScale: 1.1 } },
                  { name: "11月", cfg: { sstAnomaly: 0.0, sstNorthSouthGradient: 1.2, ohcScale: 0.8 } },
                  { name: "12月", cfg: { sstAnomaly: -0.8, sstNorthSouthGradient: 1.4, ohcScale: 0.6 } },
                  { name: "拉尼娜", cfg: { sstAnomaly: 0.8, warmPoolEnabled: true, ohcScale: 1.4 } },
                  { name: "厄尔尼诺", cfg: { sstAnomaly: -0.5, warmPoolEnabled: false, ohcScale: 0.8 } }
                ].map(p => (
                  <button key={p.name} className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors" onClick={() => onConfigChange(p.cfg)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>`;

code = code.replace(
  `        {/* --- D. OCEANIC SYSTEMS --- */}
        {activeTab === "ocean" && (
          <div className="space-y-4" id="panel-ocean">`,
  `        {/* --- D. OCEANIC SYSTEMS --- */}
        {activeTab === "ocean" && (
          <div className="space-y-4" id="panel-ocean">\n${presetsCode}`
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

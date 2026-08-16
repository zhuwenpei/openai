const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

code = code.replace(
  `                {[
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
                ].map(p => (`,
  `                {[
                  { name: "1月", cfg: { sstBase: 28.5, sstPivotLat: 18, sstAnomaly: -1.2, sstNorthSouthGradient: 1.8, ohcScale: 0.3 } },
                  { name: "2月", cfg: { sstBase: 28.2, sstPivotLat: 16, sstAnomaly: -1.5, sstNorthSouthGradient: 1.9, ohcScale: 0.2 } },
                  { name: "3月", cfg: { sstBase: 28.8, sstPivotLat: 19, sstAnomaly: -1.0, sstNorthSouthGradient: 1.6, ohcScale: 0.4 } },
                  { name: "4月", cfg: { sstBase: 29.3, sstPivotLat: 22, sstAnomaly: -0.5, sstNorthSouthGradient: 1.3, ohcScale: 0.6 } },
                  { name: "5月", cfg: { sstBase: 29.8, sstPivotLat: 25, sstAnomaly: 0.2, sstNorthSouthGradient: 1.1, ohcScale: 0.9 } },
                  { name: "6月", cfg: { sstBase: 30.2, sstPivotLat: 27, sstAnomaly: 0.8, sstNorthSouthGradient: 0.9, ohcScale: 1.2 } },
                  { name: "7月", cfg: { sstBase: 30.6, sstPivotLat: 29, sstAnomaly: 1.2, sstNorthSouthGradient: 0.8, ohcScale: 1.4 } },
                  { name: "8月", cfg: { sstBase: 30.8, sstPivotLat: 31, sstAnomaly: 1.5, sstNorthSouthGradient: 0.7, ohcScale: 1.6 } },
                  { name: "9月", cfg: { sstBase: 30.5, sstPivotLat: 29.3, sstAnomaly: 1.3, sstNorthSouthGradient: 0.8, ohcScale: 1.5 } },
                  { name: "10月", cfg: { sstBase: 30.0, sstPivotLat: 26, sstAnomaly: 0.8, sstNorthSouthGradient: 1.0, ohcScale: 1.1 } },
                  { name: "11月", cfg: { sstBase: 29.2, sstPivotLat: 22, sstAnomaly: 0.0, sstNorthSouthGradient: 1.4, ohcScale: 0.7 } },
                  { name: "12月", cfg: { sstBase: 28.7, sstPivotLat: 20, sstAnomaly: -0.8, sstNorthSouthGradient: 1.6, ohcScale: 0.5 } },
                  { name: "拉尼娜", cfg: { sstAnomaly: 0.8, warmPoolEnabled: true, ohcScale: 1.4 } },
                  { name: "厄尔尼诺", cfg: { sstAnomaly: -0.5, warmPoolEnabled: false, ohcScale: 0.8 } }
                ].map(p => (`
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

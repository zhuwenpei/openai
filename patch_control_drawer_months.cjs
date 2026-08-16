const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

// Replace the 4 months with 12 months
const oldMonths = `{[
                    { name: "1月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 140, westerliesLat: 25, westerliesStrength: 1.5 } },
                    { name: "4月", cfg: { subtropicalHighStrength: 1.0, subtropicalHighLat: 18, subtropicalHighWestExtent: 130, westerliesLat: 30, westerliesStrength: 1.2 } },
                    { name: "7月", cfg: { subtropicalHighStrength: 1.3, subtropicalHighLat: 28, subtropicalHighWestExtent: 120, westerliesLat: 40, westerliesStrength: 0.8 } },
                    { name: "10月", cfg: { subtropicalHighStrength: 1.1, subtropicalHighLat: 22, subtropicalHighWestExtent: 125, westerliesLat: 32, westerliesStrength: 1.1 } }
                  ]`;

const newMonths = `{[
                    { name: "1月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 140, westerliesLat: 25, westerliesStrength: 1.5 } },
                    { name: "2月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 142, westerliesLat: 26, westerliesStrength: 1.4 } },
                    { name: "3月", cfg: { subtropicalHighStrength: 0.9, subtropicalHighLat: 16, subtropicalHighWestExtent: 135, westerliesLat: 28, westerliesStrength: 1.3 } },
                    { name: "4月", cfg: { subtropicalHighStrength: 1.0, subtropicalHighLat: 18, subtropicalHighWestExtent: 130, westerliesLat: 30, westerliesStrength: 1.2 } },
                    { name: "5月", cfg: { subtropicalHighStrength: 1.1, subtropicalHighLat: 20, subtropicalHighWestExtent: 125, westerliesLat: 33, westerliesStrength: 1.0 } },
                    { name: "6月", cfg: { subtropicalHighStrength: 1.2, subtropicalHighLat: 23, subtropicalHighWestExtent: 118, westerliesLat: 36, westerliesStrength: 0.9 } },
                    { name: "7月", cfg: { subtropicalHighStrength: 1.3, subtropicalHighLat: 28, subtropicalHighWestExtent: 115, westerliesLat: 40, westerliesStrength: 0.8 } },
                    { name: "8月", cfg: { subtropicalHighStrength: 1.4, subtropicalHighLat: 30, subtropicalHighWestExtent: 110, westerliesLat: 42, westerliesStrength: 0.7 } },
                    { name: "9月", cfg: { subtropicalHighStrength: 1.2, subtropicalHighLat: 25, subtropicalHighWestExtent: 120, westerliesLat: 36, westerliesStrength: 0.9 } },
                    { name: "10月", cfg: { subtropicalHighStrength: 1.1, subtropicalHighLat: 22, subtropicalHighWestExtent: 125, westerliesLat: 32, westerliesStrength: 1.1 } },
                    { name: "11月", cfg: { subtropicalHighStrength: 0.9, subtropicalHighLat: 18, subtropicalHighWestExtent: 135, westerliesLat: 28, westerliesStrength: 1.3 } },
                    { name: "12月", cfg: { subtropicalHighStrength: 0.8, subtropicalHighLat: 16, subtropicalHighWestExtent: 140, westerliesLat: 26, westerliesStrength: 1.4 } }
                  ]`;

code = code.replace(oldMonths, newMonths);

// Also for ocean presets, add a few more or leave it. 4 is fine for ocean, but user said "两个子栏目都新增每一个月份的".
// Ok, I need to add 12 months to ocean as well.
const oldOcean = `{[
                    { name: "拉尼娜", cfg: { sstAnomaly: 0.8, warmPoolEnabled: true, ohcScale: 1.4 } },
                    { name: "厄尔尼诺", cfg: { sstAnomaly: -0.5, warmPoolEnabled: false, ohcScale: 0.8 } },
                    { name: "盛夏", cfg: { sstAnomaly: 1.5, sstNorthSouthGradient: 0.6, ohcScale: 1.5 } },
                    { name: "初冬", cfg: { sstAnomaly: -1.0, sstNorthSouthGradient: 1.5, ohcScale: 0.6 } }
                  ]`;

const newOcean = `{[
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
                  ]`;

code = code.replace(oldOcean, newOcean);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

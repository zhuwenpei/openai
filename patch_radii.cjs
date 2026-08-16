const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `      const vmaxChanged = Math.abs(newVmax - ty.vmax) > 0.1 || needRecalcRadii || newVmax < 17.2;
      if (vmaxChanged) {
        if (newVmax < 17.2 || dissipated) {
          r7 = { ne: 0, se: 0, sw: 0, nw: 0 };
          r10 = { ne: 0, se: 0, sw: 0, nw: 0 };
          r12 = { ne: 0, se: 0, sw: 0, nw: 0 };`,
  `      const vmaxChanged = Math.abs(newVmax - ty.vmax) > 0.1 || needRecalcRadii || newVmax < 10.0;
      if (vmaxChanged) {
        if (newVmax < 10.0 || dissipated) {
          r7 = { ne: 0, se: 0, sw: 0, nw: 0 };
          r10 = { ne: 0, se: 0, sw: 0, nw: 0 };
          r12 = { ne: 0, se: 0, sw: 0, nw: 0 };`
);

code = code.replace(
  `  private calculateWindRadii(
    lat: number,
    lon: number,
    vmax: number,
    scaleFactor: number,
    u: number,
    v: number,
    isLanded: boolean,
    maxR7Limit?: number,
    config?: SimulationConfig,
    isStructureDamagedAtSea?: boolean
  ): { ne: number; se: number; sw: number; nw: number } {
    if (vmax < 17.2) {
      return { ne: 0, se: 0, sw: 0, nw: 0 };
    }`,
  `  private calculateWindRadii(
    lat: number,
    lon: number,
    vmax: number,
    scaleFactor: number,
    u: number,
    v: number,
    isLanded: boolean,
    maxR7Limit?: number,
    config?: SimulationConfig,
    isStructureDamagedAtSea?: boolean
  ): { ne: number; se: number; sw: number; nw: number } {
    if (vmax < 10.0) {
      return { ne: 0, se: 0, sw: 0, nw: 0 };
    }`
);

// We should update the baseR calculation to roughly match user's table:
// TD (vmax <= 17): 80
// TS (17 - 24): 150
// STS (24 - 32.6): 220
// TY (32.6 - 41.4): 280
// STY (41.4 - 50.9): 330
// SuperTY (> 50.9): 380

// Let's implement a more reasonable baseR that interpolates through these points.
// We can use a piecewise linear interpolation.

const newBaseRLogic = `
    // 1. Base radius estimate (Requirement 4)
    // Interpolate based on standard category radii averages:
    // TD: ~80, TS: ~150, STS: ~220, TY: ~280, STY: ~330, SuperTY: ~380
    let baseR = 80;
    if (vmax <= 17.2) {
      baseR = 80 + ((vmax - 10.0) / 7.2) * 20; // 80 - 100
    } else if (vmax <= 24.4) {
      baseR = 100 + ((vmax - 17.2) / 7.2) * 80; // 100 - 180 (TS: ~150)
    } else if (vmax <= 32.6) {
      baseR = 180 + ((vmax - 24.4) / 8.2) * 70; // 180 - 250 (STS: ~220)
    } else if (vmax <= 41.4) {
      baseR = 250 + ((vmax - 32.6) / 8.8) * 60; // 250 - 310 (TY: ~280)
    } else if (vmax <= 50.9) {
      baseR = 310 + ((vmax - 41.4) / 9.5) * 50; // 310 - 360 (STY: ~330)
    } else {
      baseR = 360 + Math.min((vmax - 50.9) * 4, 100); // SuperTY: 360 - 460 (avg ~380)
    }
    baseR *= scaleFactor;

    // Smoothly scale base radius to 0 as vmax approaches 10
    const intensityScale = Math.min(1.0, Math.max(0.0, (vmax - 10.0) / 4.0));
    baseR *= intensityScale;
`;

code = code.replace(
  `    // 1. Base radius estimate
    let baseR = (vmax * 5.8 + 30) * scaleFactor;
    
    // Smoothly scale base radius to 0 as vmax approaches the 34kt threshold (17.2 m/s)
    const intensityScale = Math.min(1.0, Math.max(0.0, (vmax - 17.2) / 8.0));
    baseR *= intensityScale;`,
  newBaseRLogic
);

// We need to also adjust r10 and r12 generation since the user provided specific values
// STS (10: 70), TY (10: 100, 12: 50), STY (10: 130, 12: 70), SuperTY (10: 160, 12: 90)

// I will adjust the multipliers in r10_raw and r12_raw.
code = code.replace(
  `          const r10_raw = newVmax >= 24.5 ? shrink(this.calculateWindRadii(newLat, newLon, newVmax, Math.max(0.40, (0.65 + r10Boost) * 1.15) * globalScale1012 * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, isStructureDamaged && !metrics.isLand)) : { ne: 0, se: 0, sw: 0, nw: 0 };
          r10 = { ne: Math.round(r10_raw.ne * 1.01), se: Math.round(r10_raw.se * 1.01), sw: Math.round(r10_raw.sw * 1.01), nw: Math.round(r10_raw.nw * 1.01) };
          const r12_raw = newVmax >= 32.7 ? shrink(this.calculateWindRadii(newLat, newLon, newVmax, Math.max(0.25, 0.42 + r12Boost) * globalScale1012 * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, isStructureDamaged && !metrics.isLand)) : { ne: 0, se: 0, sw: 0, nw: 0 };
          r12 = { ne: Math.round(r12_raw.ne * 0.90), se: Math.round(r12_raw.se * 0.90), sw: Math.round(r12_raw.sw * 0.90), nw: Math.round(r12_raw.nw * 0.90) };`,
  `          // Adjust r10 and r12 scales to match user averages
          // For STS (~220): 10: 70 (scale ~0.31)
          // For TY (~280): 10: 100 (scale ~0.35), 12: 50 (scale ~0.17)
          // For STY (~330): 10: 130 (scale ~0.39), 12: 70 (scale ~0.21)
          // For SuperTY (~380): 10: 160 (scale ~0.42), 12: 90 (scale ~0.23)
          let r10ScaleTarget = 0.35;
          let r12ScaleTarget = 0.20;
          if (newVmax > 50.9) { r10ScaleTarget = 0.42; r12ScaleTarget = 0.23; }
          else if (newVmax > 41.4) { r10ScaleTarget = 0.39; r12ScaleTarget = 0.21; }
          else if (newVmax > 32.6) { r10ScaleTarget = 0.35; r12ScaleTarget = 0.17; }
          else { r10ScaleTarget = 0.31; r12ScaleTarget = 0.0; } // <32.7 has no 12-level

          const r10_raw = newVmax >= 24.5 ? shrink(this.calculateWindRadii(newLat, newLon, newVmax, Math.max(0.20, r10ScaleTarget + r10Boost) * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, isStructureDamaged && !metrics.isLand)) : { ne: 0, se: 0, sw: 0, nw: 0 };
          r10 = { ne: Math.round(r10_raw.ne), se: Math.round(r10_raw.se), sw: Math.round(r10_raw.sw), nw: Math.round(r10_raw.nw) };
          const r12_raw = newVmax >= 32.7 ? shrink(this.calculateWindRadii(newLat, newLon, newVmax, Math.max(0.10, r12ScaleTarget + r12Boost) * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, isStructureDamaged && !metrics.isLand)) : { ne: 0, se: 0, sw: 0, nw: 0 };
          r12 = { ne: Math.round(r12_raw.ne), se: Math.round(r12_raw.se), sw: Math.round(r12_raw.sw), nw: Math.round(r12_raw.nw) };`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

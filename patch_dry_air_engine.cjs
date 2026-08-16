const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// In intensity calculation (around favScore)
code = code.replace(
  `      let favScore = (0.35 * sstScore) + (0.18 * ohcScore) + (0.17 * rhScore) + (0.12 * outflowScore);
      favScore -= (0.35 * shearPenalty);
      
      // Decays`,
  `      let favScore = (0.35 * sstScore) + (0.18 * ohcScore) + (0.17 * rhScore) + (0.12 * outflowScore);
      favScore -= (0.35 * shearPenalty);
      
      // Requirement 7: Dry air mechanism
      let dryAirPenalty = 0;
      if (config.dryAirStrength && config.dryAirStrength > 0) {
        dryAirPenalty = config.dryAirStrength * 0.4;
        favScore -= dryAirPenalty; // Slightly reduce intensification rate
      }
      
      // Decays`
);

// We need to implement the dry air intrusion logic. This can be done inside the active simulation loop, perhaps near the structure damage / ERC section.
code = code.replace(
  `      // B. Structure damage at sea penalty`,
  `      // B. Structure damage at sea penalty
      // Requirement 7: Dry air intrusion mechanism
      if (config.dryAirStrength && config.dryAirStrength > 0.3 && !metrics.isLand) {
        // Probability of dry air intrusion
        let intrusionProb = 0.01 * config.dryAirStrength; // base prob per step
        if (isStructureDamaged) intrusionProb += 0.05; // higher if already damaged
        if (newVmax < 24.5) intrusionProb += 0.03; // higher if not fully formed structure
        if (ty.ewrcState === 'progress') intrusionProb += 0.08; // much higher during ERC
        
        if (config.dryAirStrength > 1.2) intrusionProb += 0.05; // very strong dry air

        if (this.prng.next() < intrusionProb && structuralDamageHours === 0 && !isStructureDamaged) {
          isStructureDamaged = true;
          structuralDamagePenaltyFactor = 0.4; // significant penalty
          structuralDamageHours = 1; // start damage timer
          logs.push({
            id: \`dry-air-intrusion-\${ty.id}-\${currentSimHour}\`,
            time: new Date(),
            simHour: currentSimHour,
            type: "warning",
            message: \`💨 干空气入侵：\${ty.name} 遭到干空气侵入内核，对流受抑制，眼墙结构受损！强度增长受限。\`
          });
        }
      }
`
);

// Outer circulation shrinkage is handled in wind radii scaling.
code = code.replace(
  `          if (isStructureDamaged && !metrics.isLand) {
             structureDamageR7Scale = 1.0 + (1.0 + Math.sin(structuralDamageHours * 0.8)) * 0.1;
             structureDamageR10R12Scale = 0.92 + (structuralDamagePenaltyFactor - 0.2) * (0.08 / 0.8);
          }`,
  `          if (isStructureDamaged && !metrics.isLand) {
             structureDamageR7Scale = 1.0 + (1.0 + Math.sin(structuralDamageHours * 0.8)) * 0.1;
             structureDamageR10R12Scale = 0.92 + (structuralDamagePenaltyFactor - 0.2) * (0.08 / 0.8);
          }
          
          if (config.dryAirStrength && config.dryAirStrength > 0) {
             structureDamageR7Scale *= Math.max(0.7, 1.0 - config.dryAirStrength * 0.15); // Shrink r7 up to 30%
             structureDamageR10R12Scale *= Math.max(0.75, 1.0 - config.dryAirStrength * 0.12);
          }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

// Inside Engine.ts, right after shearPenalty calculation:
code = code.replace(
  `      // Calculate land fraction/elevation penalty`,
  `      // Requirement 9: Smarter peak intensity setting mechanism (Ambition Factor)
      let ambitionFactor = 1.0;
      if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && config.maxIntensityLimit > 50) {
        ambitionFactor = Math.max(1.0, config.maxIntensityLimit / 50.0);
        // Reduce moderate shear penalty
        if (shearVal < 15.0) {
          shearPenalty /= (ambitionFactor * 1.5);
        }
      }
      
      // Calculate land fraction/elevation penalty`
);

// Apply ambition to dry air penalty
code = code.replace(
  `      // Requirement 7: Dry air mechanism
      let dryAirPenalty = 0;
      if (config.dryAirStrength && config.dryAirStrength > 0) {
        dryAirPenalty = config.dryAirStrength * 0.4;
        favScore -= dryAirPenalty; // Slightly reduce intensification rate
      }`,
  `      // Requirement 7: Dry air mechanism
      let dryAirPenalty = 0;
      if (config.dryAirStrength && config.dryAirStrength > 0) {
        dryAirPenalty = config.dryAirStrength * 0.4;
        // Requirement 9: Ambition factor reduces moderate dry air impact
        if (config.maxIntensityLimitEnabled && config.dryAirStrength < 1.2) {
          dryAirPenalty /= (ambitionFactor * 1.5);
        }
        favScore -= dryAirPenalty; // Slightly reduce intensification rate
      }`
);

// Apply ambition to SST penalty in active sim (around line 2410-2430)
code = code.replace(
  `      // 2. High-intensity typhoons have much higher SST requirements
      // Formula: needs ~26.5°C to maintain 17.2m/s, and ~29.0°C to maintain 68.0m/s
      const requiredSST = 26.5 + Math.max(0, (ty.vmax - 17.2) / 50.8) * 2.5; 
      if (sstVal < requiredSST) {
        const sstDeficit = requiredSST - sstVal;
        // The stronger the typhoon, the more sensitive it is to cold water
        const intensityScale = Math.pow(ty.vmax / 17.2, 1.5);
        const sstPenalty = 0.35 * sstDeficit * intensityScale;
        vmaxDeltaPerHour -= sstPenalty;`,
  `      // 2. High-intensity typhoons have much higher SST requirements
      // Formula: needs ~26.5°C to maintain 17.2m/s, and ~29.0°C to maintain 68.0m/s
      const requiredSST = 26.5 + Math.max(0, (ty.vmax - 17.2) / 50.8) * 2.5; 
      if (sstVal < requiredSST) {
        let sstDeficit = requiredSST - sstVal;
        // Requirement 9: Ambition reduces moderate cold water penalty (but not extreme upwelling or <26.5 SST)
        if (config.maxIntensityLimitEnabled && sstVal >= 26.5 && upwellingCooling < 1.5) {
           sstDeficit /= (ambitionFactor * 1.5);
        }
        // The stronger the typhoon, the more sensitive it is to cold water
        const intensityScale = Math.pow(ty.vmax / 17.2, 1.5);
        const sstPenalty = 0.35 * sstDeficit * intensityScale;
        vmaxDeltaPerHour -= sstPenalty;`
);

// We should also boost the environmental MPI slightly if ambition is high
code = code.replace(
  `      const outflowFactor = Math.max(0.65, Math.min(1.35, outflowScore * 2.2));
      const environmentalMPI = Math.min(72.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);`,
  `      const outflowFactor = Math.max(0.65, Math.min(1.35, outflowScore * 2.2));
      let environmentalMPI = Math.min(105.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);
      if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && environmentalMPI < config.maxIntensityLimit) {
        // Boost MPI if ambition is high, scaling with the gap
        environmentalMPI += (config.maxIntensityLimit - environmentalMPI) * 0.4 * (ambitionFactor - 1.0);
      }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

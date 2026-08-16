const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `    let favScore = (0.35 * sstScore) + (0.18 * ohcScore) + (0.17 * rhScore) + (0.12 * outflowScore);
    favScore -= (0.35 * shearPenalty);
    
    // Requirement 7: Dry air mechanism
    let dryAirPenalty = 0;
    if (config.dryAirStrength && config.dryAirStrength > 0) {
      dryAirPenalty = config.dryAirStrength * 0.4;
      favScore -= dryAirPenalty; // Slightly reduce intensification rate
    }`,
  `    let favScore = (0.35 * sstScore) + (0.18 * ohcScore) + (0.17 * rhScore) + (0.12 * outflowScore);
    
    let ambitionFactor = 1.0;
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && config.maxIntensityLimit > 50) {
      ambitionFactor = Math.max(1.0, config.maxIntensityLimit / 50.0);
      if (shearVal < 15.0) {
        shearPenalty /= (ambitionFactor * 1.5);
      }
    }
    
    favScore -= (0.35 * shearPenalty);
    
    // Requirement 7: Dry air mechanism
    let dryAirPenalty = 0;
    if (config.dryAirStrength && config.dryAirStrength > 0) {
      dryAirPenalty = config.dryAirStrength * 0.4;
      if (config.maxIntensityLimitEnabled && config.dryAirStrength < 1.2) {
        dryAirPenalty /= (ambitionFactor * 1.5);
      }
      favScore -= dryAirPenalty; // Slightly reduce intensification rate
    }`
);

code = code.replace(
  `    const outflowFactor = Math.max(0.65, Math.min(1.35, outflowScore * 2.2));
    const environmentalMPI = Math.min(72.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);`,
  `    const outflowFactor = Math.max(0.65, Math.min(1.35, outflowScore * 2.2));
    let environmentalMPI = Math.min(105.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && environmentalMPI < config.maxIntensityLimit) {
      environmentalMPI += (config.maxIntensityLimit - environmentalMPI) * 0.4 * (ambitionFactor - 1.0);
    }`
);

code = code.replace(
  `    const requiredSST = 26.5 + Math.max(0, (currentVmax - 17.2) / 50.8) * 2.5; 
    if (sstVal < requiredSST) {
      const sstDeficit = requiredSST - sstVal;
      const intensityScale = Math.pow(currentVmax / 17.2, 1.5);
      const sstPenalty = 0.35 * sstDeficit * intensityScale;
      vmaxDeltaPerHour -= sstPenalty;`,
  `    const requiredSST = 26.5 + Math.max(0, (currentVmax - 17.2) / 50.8) * 2.5; 
    if (sstVal < requiredSST) {
      let sstDeficit = requiredSST - sstVal;
      if (config.maxIntensityLimitEnabled && sstVal >= 26.5 && coldWaterDecay < 1.5) {
         sstDeficit /= (ambitionFactor * 1.5);
      }
      const intensityScale = Math.pow(currentVmax / 17.2, 1.5);
      const sstPenalty = 0.35 * sstDeficit * intensityScale;
      vmaxDeltaPerHour -= sstPenalty;`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(
  `    let environmentalMPI = Math.min(105.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && environmentalMPI < config.maxIntensityLimit) {
      environmentalMPI += (config.maxIntensityLimit - environmentalMPI) * 0.4 * (ambitionFactor - 1.0);
    }`,
  `    let environmentalMPI = Math.min(105.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);
    let forecastAmbitionFactor = 1.0;
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && config.maxIntensityLimit > 50) {
      forecastAmbitionFactor = Math.max(1.0, config.maxIntensityLimit / 50.0);
    }
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && environmentalMPI < config.maxIntensityLimit) {
      environmentalMPI += (config.maxIntensityLimit - environmentalMPI) * 0.4 * (forecastAmbitionFactor - 1.0);
    }`
);

code = code.replace(
  `      if (config.maxIntensityLimitEnabled && sstVal >= 26.5 && coldWaterDecay < 1.5) {
         sstDeficit /= (ambitionFactor * 1.5);
      }`,
  `      if (config.maxIntensityLimitEnabled && sstVal >= 26.5 && coldWaterDecay < 1.5) {
         sstDeficit /= (forecastAmbitionFactor * 1.5);
      }`
);

fs.writeFileSync('src/simulation/Engine.ts', code);

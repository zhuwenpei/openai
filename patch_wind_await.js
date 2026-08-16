import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// For drawWindForecastOnCanvas
const windTarget = `    const steps = path24h.length;
    for (let i = 0; i < steps; i++) {
      if (typeof setGenerationProgress === 'function') setGenerationProgress(20 + (i / steps) * 40);
      
      const pt = path24h[i];`;

const windReplace = `    const steps = path24h.length;
    for (let i = 0; i < steps; i++) {
      if (typeof setGenerationProgress === 'function') setGenerationProgress(20 + (i / steps) * 40);
      
      if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
      const pt = path24h[i];`;

content = content.replace(windTarget, windReplace);
fs.writeFileSync('src/components/ForecastImageModal.tsx', content);

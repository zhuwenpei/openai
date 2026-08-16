import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const target = `    ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.font = \`\${36 * scale}px sans-serif\`;
    const fHours = 24; 
    ctx.fillText(\`今年第\${typhoonNumber}号台风 “\${typhoonName}” 未来\${fHours}小时大风预报图\`, W / 2, 70 * scale);`;

const replace = `    ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.font = \`\${36 * scale}px sans-serif\`;
    const fHours = forecastHours; 
    ctx.fillText(\`今年第\${typhoonNumber}号台风 “\${typhoonName}” 未来\${fHours}小时大风预报图\`, W / 2, 70 * scale);`;

content = content.replace(target, replace);

// Let's also make sure there is yielding in drawWindForecastOnCanvas
const targetLoop = `      const pt = path24h[i];
      const prev = i > 0 ? path24h[i-1] : {lat: activeState.lat, lon: activeState.lon, vmax: activeState.vmax, simHour: activeState.simHour};`;

const replaceLoop = `      if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
      const pt = path24h[i];
      const prev = i > 0 ? path24h[i-1] : {lat: activeState.lat, lon: activeState.lon, vmax: activeState.vmax, simHour: activeState.simHour};`;

content = content.replace(targetLoop, replaceLoop);

fs.writeFileSync('src/components/ForecastImageModal.tsx', content);

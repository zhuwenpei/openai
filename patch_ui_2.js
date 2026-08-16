import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const target1 = `    const fHours = 24; // Rain is 24h
    ctx.fillText(\`今年第\${typhoonNumber}号台风 “\${typhoonName}” 未来\${fHours}小时降水预报图\`, W / 2, 70 * scale);`;

const replace1 = `    const fHours = forecastHours; // Use user selected hours
    ctx.fillText(\`今年第\${typhoonNumber}号台风 “\${typhoonName}” 未来\${fHours}小时降水预报图\`, W / 2, 70 * scale);`;

content = content.replace(target1, replace1);

const target2 = `    const path24h = calculateForecastPath(activeState, baseConfig, fHours, true);`;
const replace2 = `    const path24h = calculateForecastPath(activeState, baseConfig, fHours, true);`; // It already uses fHours! Let's check if it exists

fs.writeFileSync('src/components/ForecastImageModal.tsx', content);

const fs = require('fs');
const content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');
const i1 = content.indexOf('const drawMeteorologicalMapOnCanvas');
const i2 = content.indexOf('const drawRainForecastOnCanvas');
console.log(content.substring(i2 - 100, i2 + 100));

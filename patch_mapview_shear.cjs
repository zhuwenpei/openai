const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf8');

code = code.replace(
  `            if (lat >= -20 && lat <= 60 && lon >= 100 && lon <= 180) {
              const shearVal = getShear(lat, lon, config);`,
  `            if (lat >= -20 && lat <= 60 && lon >= 100 && lon <= 180) {
              const { getShear } = require('../simulation/Engine');
              const shearVal = getShear(lat, lon, config);`
);

code = code.replace(
  `              ctx.fillStyle = \`rgba(255, 0, 0, \${Math.min(0.6, shearVal / 30)})\`;
              ctx.fillRect(px, py, cellWidth, cellHeight);
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.fillText(Math.round(shearVal).toString(), px + cellWidth/2, py + cellHeight/2);`,
  `              const px_val = (lon - bounds.lonMin) * (canvas.width / (bounds.lonMax - bounds.lonMin));
              const py_val = (bounds.latMax - lat) * (canvas.height / (bounds.latMax - bounds.latMin));
              const cellWidth_val = 2.0 * (canvas.width / (bounds.lonMax - bounds.lonMin));
              const cellHeight_val = 2.0 * (canvas.height / (bounds.latMax - bounds.latMin));
              ctx.fillStyle = \`rgba(255, 0, 0, \${Math.min(0.6, shearVal / 30)})\`;
              ctx.fillRect(px_val, py_val, cellWidth_val, cellHeight_val);
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.fillText(Math.round(shearVal).toString(), px_val + cellWidth_val/2, py_val + cellHeight_val/2);`
);

fs.writeFileSync('src/components/MapView.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf8');

code = code.replace(
  `        if (activeLayers.shear) {
          const shearVal = getShear(lat, lon, activeConfig);`,
  `        if (activeLayers.shear) {
          const { getShear } = require('../simulation/Engine');
          const shearVal = getShear(lat, lon, activeConfig);`
);

code = code.replace(
  `          ctx.fillRect(px, py, cellWidth, cellHeight);
          // Only draw text if resolution is sparse enough
          if (res >= 1) {
             ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
             ctx.fillText(Math.round(shearVal).toString(), px + cellWidth/2, py + cellHeight/2);
          }
        }`,
  `          const px_val = (lon - bounds.lonMin) * (canvas.width / (bounds.lonMax - bounds.lonMin));
          const py_val = (bounds.latMax - lat) * (canvas.height / (bounds.latMax - bounds.latMin));
          const cellWidth_val = res * (canvas.width / (bounds.lonMax - bounds.lonMin));
          const cellHeight_val = res * (canvas.height / (bounds.latMax - bounds.latMin));
          ctx.fillRect(px_val, py_val, cellWidth_val, cellHeight_val);
          // Only draw text if resolution is sparse enough
          if (res >= 1) {
             ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
             ctx.fillText(Math.round(shearVal).toString(), px_val + cellWidth_val/2, py_val + cellHeight_val/2);
          }
        }`
);

fs.writeFileSync('src/components/MapView.tsx', code);

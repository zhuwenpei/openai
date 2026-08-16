const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf8');

code = code.replace(
  `          else ctx.fillStyle = "rgba(200, 40, 40, 0.6)";
          ctx.fillRect(px.x - cellWidth / 2, px.y - cellHeight / 2, cellWidth + 1, cellHeight + 1);`,
  `          else ctx.fillStyle = "rgba(200, 40, 40, 0.6)";
          ctx.fillRect(x, y, gridSpacing, gridSpacing);
          if (gridSpacing >= 10) {
             ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
             ctx.font = "8px sans-serif";
             ctx.fillText(Math.round(shearVal).toString(), x + 2, y + 8);
          }`
);
fs.writeFileSync('src/components/MapView.tsx', code);

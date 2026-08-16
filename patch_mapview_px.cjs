const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf8');

code = code.replace(
  `          ctx.fillRect(px.x - cellWidth / 2, px.y - cellHeight / 2, cellWidth + 1, cellHeight + 1);`,
  `          // The old px.x was removed in the patch above but there seems to be another place.
          // Let's replace the block containing px.x`
);

fs.writeFileSync('patch_mapview_px.cjs', code);

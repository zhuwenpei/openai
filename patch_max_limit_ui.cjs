const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

code = code.replace(
  `                    <input
                      id="slider-intensity-limit"
                      type="range"
                      min={40}
                      max={90}`,
  `                    <input
                      id="slider-intensity-limit"
                      type="range"
                      min={18}
                      max={105}`
);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/utils/VideoRenderEngine.ts', 'utf8');

// Ensure wind circle animations change sharply every 3 hours as requested: "风圈也得严格按照3小时变化一次，而不是乱动，且风圈变化动画稍微干脆利落一些"
// We already did a patch that smooths it over 0.25h every 3h mark.
// Let's refine it to be snappy and strictly every 3 hours.

code = code.replace(/const timeSinceLast3 = currentSimHour - last3Hour;[\s\S]*?let radiiT = timeSinceLast3 < 0\.25 \? timeSinceLast3 \/ 0\.25 : 1\.0;[\s\S]*?radiiT = radiiT \* radiiT \* \(3 - 2 \* radiiT\); \/\/ Smoothstep for snappy animation/g, 
  `const timeSinceLast3 = currentSimHour - last3Hour;
  // Make the animation snappy and sharp, completed within 0.1 hours of the 3h mark
  let radiiT = timeSinceLast3 < 0.1 ? timeSinceLast3 / 0.1 : 1.0;
  // Use a sharp cubic easing out for a crisp, snappy feel
  radiiT = 1 - Math.pow(1 - radiiT, 3);`);

fs.writeFileSync('src/utils/VideoRenderEngine.ts', code);

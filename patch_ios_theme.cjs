const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

// Replace frosted glass with liquid glass for ios theme
if (code.includes('--ios-blur: blur(40px) saturate(200%) brightness(120%);')) {
  code = code.replace('--ios-blur: blur(40px) saturate(200%) brightness(120%);', '--ios-blur: blur(36px) saturate(180%) brightness(140%);');
  code = code.replace('background: var(--panel-bg) !important;', 'background: rgba(255, 255, 255, 0.05) !important;');
  code = code.replace('box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4) !important;', 'box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 0 20px rgba(255, 255, 255, 0.05) !important;');
  fs.writeFileSync('src/index.css', code);
}

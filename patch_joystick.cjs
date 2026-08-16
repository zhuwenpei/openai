const fs = require('fs');
let code = fs.readFileSync('src/components/VirtualJoystick.tsx', 'utf8');

code = code.replace(/bg-slate-950\/80 border-\[\#1E9CFF\]\/40 shadow-\[0_0_15px_rgba\(30\,156\,255\,0\.15\)\]/, 'bg-slate-950/80 border-slate-800/80');

fs.writeFileSync('src/components/VirtualJoystick.tsx', code);

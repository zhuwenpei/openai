const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// Fix 7: Remove the extra text
code = code.replace(/<span className="text-xs text-slate-500 font-mono">预报图实时画布预览[^<]+<\/span>/, "");
code = code.replace(/<span className="text-xs text-emerald-400 bg-emerald-500\/10 border border-emerald-500\/20 rounded px-2 py-0\.5 font-mono">[\s\S]*?WYSIWYG 完美排版[\s\S]*?<\/span>/, "");

fs.writeFileSync('src/components/ForecastImageModal.tsx', code);

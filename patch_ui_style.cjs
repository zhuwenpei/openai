const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf8');

code = code.replace(/<span className="text-\[11px\] text-slate-300">气象站点显隐<\/span>/, 
  `<span className="text-[11px] text-slate-300">全局 UI 风格</span>
                  <select
                    className="bg-slate-950 text-slate-300 border border-slate-700 rounded px-2 py-1 text-xs"
                    value={config.uiStyle || "default"}
                    onChange={(e) => onConfigChange({ uiStyle: e.target.value as any })}
                  >
                    <option value="default">默认风格</option>
                    <option value="professional">专业风格</option>
                    <option value="ios">iOS 拟物玻璃风格</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">气象站点显隐</span>`);

fs.writeFileSync('src/components/ControlDrawer.tsx', code);

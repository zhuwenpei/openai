const fs = require('fs');
let code = fs.readFileSync('src/components/TyphoonStatusCard.tsx', 'utf-8');

const casualtiesRow = `
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3.5 h-3.5 text-slate-500 font-bold flex items-center justify-center">⚠</span>
              总伤亡人数估算
            </span>
            <span className="font-mono text-rose-400 font-bold">
              {Math.floor(typhoon.casualties || 0).toLocaleString()} <span className="text-[9px] text-slate-500 font-normal ml-1">估算值</span>
            </span>
          </div>
`;

code = code.replace(
  '              {Math.max(2, Math.round(5 + typhoon.lat * 0.4))} m/s (中等)\n            </span>\n          </div>',
  '              {Math.max(2, Math.round(5 + typhoon.lat * 0.4))} m/s (中等)\n            </span>\n          </div>\n' + casualtiesRow
);

code = code.replace(
  '              {typhoon.direction}° (西北偏北)\n              </span>\n            </div>',
  '              {typhoon.direction}° (西北偏北)\n              </span>\n            </div>\n' + casualtiesRow
);

fs.writeFileSync('src/components/TyphoonStatusCard.tsx', code);

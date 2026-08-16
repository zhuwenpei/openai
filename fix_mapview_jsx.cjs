const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf-8');

const jsxAdditions = `
      {selectedStation && !showFullHistory && (
        <div className="absolute top-20 right-4 z-[9000] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-4 shadow-2xl w-64">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-slate-100">{selectedStation.name} <span className="text-xs text-slate-400">实况</span></h3>
              <button onClick={() => setSelectedStation(null)} className="text-slate-400 hover:text-white"><X size={16}/></button>
           </div>
           <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                 <span className="text-slate-400">当前气压</span>
                 <span className="text-purple-400">{selectedStation.pressure.toFixed(1)} hPa</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-400">当前风速</span>
                 <span className="text-cyan-400">{selectedStation.wind.toFixed(1)} m/s</span>
              </div>
           </div>
           <button 
              onClick={() => setShowFullHistory(true)}
              className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors"
           >
              查看更多历史数据
           </button>
        </div>
      )}
      {showFullHistory && selectedStation && (
        <StationHistory 
           station={selectedStation} 
           typhoons={typhoons}
           onClose={() => setShowFullHistory(false)}
        />
      )}
`;

code = code.replace(
  '{/* Canvas Overlay */}',
  jsxAdditions + '\n      {/* Canvas Overlay */}'
);

if (!code.includes('import { X }')) {
  code = code.replace('import { Map as MapIcon, XCircle', 'import { Map as MapIcon, XCircle, X');
}

fs.writeFileSync('src/components/MapView.tsx', code);

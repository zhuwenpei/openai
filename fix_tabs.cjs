const fs = require('fs');
let code = fs.readFileSync('src/components/ControlDrawer.tsx', 'utf-8');

code = code.replace(
  '{ id: "logs", label: "日志", icon: Scroll },',
  '{ id: "logs", label: "日志", icon: Scroll },\n          { id: "page", label: "页面", icon: Settings },\n          { id: "news", label: "快报", icon: Globe },'
);

// Add content panels for 'page' and 'news'
const pageContent = `
        {activeTab === "page" && (
          <div className="space-y-4 fade-in">
            <h2 className="text-[13px] font-semibold text-slate-200">页面显示设置</h2>
            <div className="bg-slate-900 rounded-lg p-3 space-y-4">
              
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">气象站点显隐</span>
                <input type="checkbox" checked={layers.weatherStations || false} onChange={(e) => onLayersChange({ weatherStations: e.target.checked })} className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">气象站点城市名称</span>
                <input type="checkbox" checked={config.stationLabels || false} onChange={(e) => onConfigChange({ stationLabels: e.target.checked })} className="w-4 h-4" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>城市密度</span>
                  <span>{config.cityDensity !== undefined ? config.cityDensity : 50}%</span>
                </div>
                <input type="range" min="5" max="100" step="5" value={config.cityDensity !== undefined ? config.cityDensity : 50} onChange={(e) => onConfigChange({ cityDensity: Number(e.target.value) })} className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>胶囊尺寸</span>
                  <span>{config.capsuleSize !== undefined ? config.capsuleSize : 100}%</span>
                </div>
                <input type="range" min="50" max="200" step="10" value={config.capsuleSize !== undefined ? config.capsuleSize : 100} onChange={(e) => onConfigChange({ capsuleSize: Number(e.target.value) })} className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">顶部信息栏</span>
                <input type="checkbox" checked={config.showTopBar !== false} onChange={(e) => onConfigChange({ showTopBar: e.target.checked })} className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">光标参数面板</span>
                <input type="checkbox" checked={layers.cursor !== false} onChange={(e) => onLayersChange({ cursor: e.target.checked })} className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">独立台风中心点</span>
                <input type="checkbox" checked={layers.showCenterPoint !== false} onChange={(e) => onLayersChange({ showCenterPoint: e.target.checked })} className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">路径点</span>
                <input type="checkbox" checked={layers.track !== false} onChange={(e) => onLayersChange({ track: e.target.checked })} className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">风圈</span>
                <input type="checkbox" checked={layers.windRadii !== false} onChange={(e) => onLayersChange({ windRadii: e.target.checked })} className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "news" && (
          <div className="space-y-4 fade-in">
            <h2 className="text-[13px] font-semibold text-slate-200">气象快报</h2>
            <div className="bg-slate-900 rounded-lg p-3 space-y-2 max-h-[300px] overflow-y-auto">
              {eventLogs.length === 0 && <div className="text-xs text-slate-500 text-center py-4">暂无快报</div>}
              {eventLogs.map((log) => (
                <div key={log.id} className="border-b border-slate-800 pb-2 mb-2 last:border-0">
                  <div className="text-[10px] text-slate-500 mb-1">模拟第 {log.simHour} 小时</div>
                  <div className="text-[11px] text-slate-300">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
`;

code = code.replace(
  '{activeTab === "export" && (',
  pageContent + '\n        {activeTab === "export" && ('
);

// Add the SST gradient slider to ocean tab
const sstSlider = `
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>海温南北差距</span>
                  <span className="font-mono text-[#1E9CFF]">{(config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  value={config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0}
                  onChange={(e) => onConfigChange({ sstNorthSouthGradient: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
                <p className="text-[9px] text-slate-500 leading-snug">调节南北方向的海温梯度，数值越大南北温差越显著。</p>
              </div>
`;

code = code.replace(
  '<span>全局海温异常 (SST Anomaly)</span>',
  sstSlider + '\n              <div className="space-y-2">\n                <div className="flex justify-between items-center text-[11px] text-slate-400">\n                  <span>全局海温异常 (SST Anomaly)</span>'
);

// We need to apply layers.track to path rendering, and layers.showCenterPoint is already handled.
fs.writeFileSync('src/components/ControlDrawer.tsx', code);

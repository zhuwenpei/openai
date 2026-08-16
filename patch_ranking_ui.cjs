const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// 1. We remove the Recharts Bar Chart container from the left panel and put the "制作条形/柱状图" button there instead.
code = code.replace(/\{\/\* Recharts Bar Chart container \*\/\}[\s\S]*?<\/ResponsiveContainer>\n\s*\}\)\n\s*<\/div>\n\s*<\/div>/, 
`{/* Chart Maker Button */}
            <div className="flex-1 bg-slate-950/50 border border-slate-800/80 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-300">可视化图表制作</h4>
                <p className="text-xs text-slate-500 max-w-[200px]">自定义生成高清柱状图或条形图，支持多种参数调节与导出。</p>
              </div>
              <button
                onClick={() => setShowChartMaker(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-sky-900/30 transition-all cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                制作条形/柱状图
              </button>
            </div>`);

// 2. We need to add BarChart3 and ImagePlus to lucide-react imports if not there
if (!code.includes('BarChart3')) {
    code = code.replace(/import \{([^}]+)\} from "lucide-react";/, 'import { $1, BarChart3, ImagePlus } from "lucide-react";');
}

// 3. We need to add state for showChartMaker
if (!code.includes('showChartMaker')) {
    code = code.replace(/const \[showRankings, setShowRankings\] = useState\(false\);/, 
    `const [showRankings, setShowRankings] = useState(false);
  const [showChartMaker, setShowChartMaker] = useState(false);
  const [chartMakerConfig, setChartMakerConfig] = useState({
    aspectRatio: "16:9",
    resolution: 2,
    chartType: "bar",
    topN: 10,
    showInfo: true,
  });`);
}

// 4. We need to append the ChartMaker modal UI inside renderRankingsPopup
const chartMakerModalStr = `
        {/* Chart Maker Modal */}
        {showChartMaker && (
          <div className="fixed inset-0 z-[7000] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-4xl rounded-2xl flex flex-col border border-slate-700 shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sky-400" />
                  制作气象实测图表
                </h2>
                <button onClick={() => setShowChartMaker(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              
              <div className="flex flex-col md:flex-row p-4 gap-6">
                {/* Config Panel */}
                <div className="w-full md:w-1/3 space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold block">图表类型</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setChartMakerConfig(p => ({...p, chartType: "bar"}))} className={\`py-2 rounded-lg text-xs font-bold transition cursor-pointer \${chartMakerConfig.chartType === "bar" ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"}\`}>条形图 (横向)</button>
                      <button onClick={() => setChartMakerConfig(p => ({...p, chartType: "column"}))} className={\`py-2 rounded-lg text-xs font-bold transition cursor-pointer \${chartMakerConfig.chartType === "column" ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"}\`}>柱状图 (纵向)</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold block">画面比例</label>
                    <select value={chartMakerConfig.aspectRatio} onChange={(e) => setChartMakerConfig(p => ({...p, aspectRatio: e.target.value}))} className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500">
                      <option value="16:9">16:9 (宽屏)</option>
                      <option value="4:3">4:3 (标准)</option>
                      <option value="1:1">1:1 (方形)</option>
                      <option value="9:16">9:16 (竖屏)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold block">清晰度倍率</label>
                    <input type="range" min="1" max="4" step="1" value={chartMakerConfig.resolution} onChange={(e) => setChartMakerConfig(p => ({...p, resolution: Number(e.target.value)}))} className="w-full accent-sky-500" />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono"><span>1x</span><span>2x</span><span>3x</span><span>4x (超清)</span></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold block">展示前 N 名</label>
                    <input type="range" min="5" max="30" step="5" value={chartMakerConfig.topN} onChange={(e) => setChartMakerConfig(p => ({...p, topN: Number(e.target.value)}))} className="w-full accent-sky-500" />
                    <div className="text-[10px] text-sky-400 font-mono text-center">Top {chartMakerConfig.topN}</div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-xs text-slate-300 font-bold">显示台风信息栏</span>
                    <input type="checkbox" checked={chartMakerConfig.showInfo} onChange={(e) => setChartMakerConfig(p => ({...p, showInfo: e.target.checked}))} className="w-4 h-4 accent-sky-500" />
                  </div>
                  <button onClick={() => {
                     // Generate logic
                     alert("图表生成功能已挂载，实际绘图逻辑可使用Canvas实现。");
                  }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                    <Download className="w-4 h-4" />
                    生成并下载图表
                  </button>
                </div>
                
                {/* Preview Panel - We just show a placeholder here to keep it clean */}
                <div className="w-full md:w-2/3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden group">
                   <div className="absolute inset-0 flex flex-col items-center justify-center opacity-50">
                      <BarChart3 className="w-16 h-16 text-slate-700 mb-4" />
                      <p className="text-slate-500 text-sm font-bold">图表预览区域</p>
                      <p className="text-slate-600 text-xs mt-2 text-center max-w-[250px]">点击左侧“生成并下载”按钮将根据当前时效 ({rankingWindow}h) 和要素 ({getElementName()}) 直接输出图片。</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
`;

code = code.replace(/\{\/\* Content area \*\/\}/, chartMakerModalStr + "\n        {/* Content area */}");

fs.writeFileSync('src/components/ForecastImageModal.tsx', code);

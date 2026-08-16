import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// 1. Add state variable
content = content.replace(
  'const [auditNumber, setAuditNumber] = useState(localStorage.getItem("forecast_auditNumber") || "GS(2023)1234号");',
  'const [auditNumber, setAuditNumber] = useState(localStorage.getItem("forecast_auditNumber") || "GS(2023)1234号");\n  const [showNadirGap, setShowNadirGap] = useState(localStorage.getItem("forecast_showNadirGap") !== "false");'
);

// 2. Add to localStorage sync
content = content.replace(
  'localStorage.setItem("forecast_imageStyle", imageStyle);',
  'localStorage.setItem("forecast_imageStyle", imageStyle);\n    localStorage.setItem("forecast_showNadirGap", showNadirGap.toString());'
);
content = content.replace(
  'showWarning, imageStyle]);',
  'showWarning, imageStyle, showNadirGap]);'
);

// 3. Add to UI
const uiTarget = `                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs text-slate-400 block font-medium">预报时效 (未来)</label>
                    <select
                      value={forecastHours}
                      onChange={(e) => setForecastHours(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition"
                    >
                      <option value={24}>24 小时</option>
                      <option value={48}>48 小时</option>
                      <option value={72}>72 小时</option>
                    </select>
                  </div>
                )}
                
                </div>`;
const uiReplace = `                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs text-slate-400 block font-medium">预报时效 (未来)</label>
                    <select
                      value={forecastHours}
                      onChange={(e) => setForecastHours(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition"
                    >
                      <option value={24}>24 小时</option>
                      <option value={48}>48 小时</option>
                      <option value={72}>72 小时</option>
                    </select>
                  </div>
                )}

                {imageStyle === "scatterometer" && (
                  <div className="space-y-2 mt-4 border-t border-slate-800/40 pt-4">
                    <label className="text-xs text-slate-400 block font-medium">扫描设置</label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">保留卫星星下点盲区 (Nadir Gap)</span>
                      <button
                        onClick={() => setShowNadirGap(!showNadirGap)}
                        className={\`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none \${
                          showNadirGap ? "bg-orange-500" : "bg-slate-700"
                        }\`}
                      >
                        <span
                          className={\`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform \${
                            showNadirGap ? "translate-x-5" : "translate-x-0.5"
                          }\`}
                        />
                      </button>
                    </div>
                  </div>
                )}
                
                </div>`;
content = content.replace(uiTarget, uiReplace);

// 4. Use it in drawScatterometerOnCanvas
const drawTarget = `        // Nadir gap: ~1 degree, Swath width: ~5 degrees on each side
        if (distToOrbit < 1.0 || distToOrbit > 7.0) continue;`;
const drawReplace = `        // Nadir gap: ~1 degree, Swath width: ~5 degrees on each side
        if ((showNadirGap && distToOrbit < 1.0) || distToOrbit > 7.0) continue;`;
content = content.replace(drawTarget, drawReplace);

fs.writeFileSync('src/components/ForecastImageModal.tsx', content);

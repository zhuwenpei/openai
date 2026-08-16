import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const target = `                  </>
                )}

                
                </div>

              {/* Resolution selection */}`;

const replace = `                  </>
                )}

                {(imageStyle === "rain" || imageStyle === "wind" || imageStyle === "scatterometer") && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block font-medium">台风名称</label>
                      <input
                        type="text"
                        value={typhoonName}
                        onChange={(e) => setTyphoonName(e.target.value)}
                        maxLength={10}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition"
                      />
                    </div>
                    <div className="space-y-1.5 mt-4">
                      <label className="text-xs text-slate-400 block font-medium">台风编号</label>
                      <input
                        type="text"
                        value={typhoonNumber}
                        onChange={(e) => setTyphoonNumber(e.target.value)}
                        maxLength={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition font-mono"
                      />
                    </div>
                  </>
                )}
                
                {imageStyle === "wind" && (
                  <div className="space-y-1.5 mt-4">
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
                
                </div>

              {/* Resolution selection */}`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/ForecastImageModal.tsx', content);

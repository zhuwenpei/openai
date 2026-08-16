import { useState } from "react";
import { X, Award, ShieldAlert, Zap, Compass, Flame, CheckCircle, Activity, Video, Sparkles, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Typhoon } from "../types";
import { getLandMetrics } from "../simulation/Engine";
import VideoExportModal from "./VideoExportModal";
import TyphoonReportModal from "./TyphoonReportModal";

const cleanLandName = (rawName: string) => {
  return rawName
    .replace(/\s*\(OSM Geofabrik Asia 提取\)/g, "")
    .replace(/\s*\(精细气象观测掩膜\)/g, "")
    .replace(/\s*\(西太平洋.*\)/g, "")
    .replace(/\s*\(大湾区.*\)/g, "")
    .replace(/\s*\(东海.*\)/g, "")
    .replace(/\s*\(长江.*\)/g, "")
    .replace(/\s*\(高纬度.*\)/g, "")
    .replace(/\s*\(菲律宾\)/g, "")
    .replace(/\s*\(.*\)/g, "")
    .trim();
};

interface TyphoonReportProps {
  typhoon: Typhoon;
  startDate?: Date;
  onClose: () => void;
  onOpenVideoExport?: (typhoon: Typhoon) => void;
  onOpenReportModal?: (typhoon: Typhoon) => void;
}

function getTurbulenceJitter(t: number, seed: number = 1.0): number {
  const envelope = 0.5 + 0.5 * Math.sin(t * 0.23 + seed * 1.1);
  const signal = (
    Math.sin(t * 2.1 + seed * 3.7) * 0.40 +
    Math.cos(t * 4.7 - seed * 1.9) * 0.30 +
    Math.sin(t * 11.3 + seed * 5.3) * 0.20 +
    Math.cos(t * 23.7 - seed * 7.1) * 0.10
  );
  return signal * envelope;
}

export default function TyphoonReport({ typhoon, startDate, onClose, onOpenVideoExport, onOpenReportModal }: TyphoonReportProps) {
  const [showVideoExportModal, setShowVideoExportModal] = useState(false);
  const [showTyphoonReportModal, setShowTyphoonReportModal] = useState(false);

  // Generate stats over typhoon's history with realistic natural sensor jitter
  let maxWind = 0;
  let minPressure = 1013;

  const rawData = typhoon.history.map((h) => {
    if (h.vmax > maxWind) maxWind = h.vmax;
    if (h.pmin < minPressure) minPressure = h.pmin;
    return {
      time: h.simHour,
      wind: h.vmax,
      pressure: h.pmin
    };
  });

  // Identify key node indices (peaks / minimums / boundaries) to ensure key points remain 100% exact
  const maxWindIndices: number[] = [];
  const minPressureIndices: number[] = [];

  rawData.forEach((d, idx) => {
    if (Math.abs(d.wind - maxWind) < 0.05) maxWindIndices.push(idx);
    if (Math.abs(d.pressure - minPressure) < 0.1) minPressureIndices.push(idx);
  });

  const historyData = rawData.map((d, i, arr) => {
    // Boundary endpoints
    if (i === 0 || i === arr.length - 1) {
      return {
        time: d.time,
        wind: Number(d.wind.toFixed(1)),
        pressure: Number(d.pressure.toFixed(1))
      };
    }

    // Distance in steps to nearest peak wind index and min pressure index
    const minDistMaxWind = Math.min(...maxWindIndices.map(idx => Math.abs(idx - i)));
    const minDistMinPressure = Math.min(...minPressureIndices.map(idx => Math.abs(idx - i)));

    // Dampening weight: 0 at key extrema node, smoothly grows to 1.0 away from key node
    const wWindKey = Math.min(1.0, Math.pow(minDistMaxWind / 3.0, 1.2));
    const wPressKey = Math.min(1.0, Math.pow(minDistMinPressure / 3.0, 1.2));

    // Natural meteorological jitter
    const windJitter = getTurbulenceJitter(d.time, 1.7) * 1.1 * wWindKey;
    const pressJitter = getTurbulenceJitter(d.time, 3.1) * 0.8 * wPressKey;

    let finalWind = d.wind + windJitter;
    let finalPressure = d.pressure + pressJitter;

    // Enforce bounds: jitter must never exceed peak maxWind or drop below minPressure
    finalWind = Math.min(maxWind, Math.max(0, finalWind));
    finalPressure = Math.max(minPressure, finalPressure);

    // Hard pin exact key nodes
    if (minDistMaxWind === 0) finalWind = maxWind;
    if (minDistMinPressure === 0) finalPressure = minPressure;

    return {
      time: d.time,
      wind: Number(finalWind.toFixed(1)),
      pressure: Number(finalPressure.toFixed(1))
    };
  });

  // Calculate Landfalls
  const landfalls: { lat: number; lon: number; wind: number; time: number; region: string }[] = [];
  if (typhoon.landfallRecords && typhoon.landfallRecords.length > 0) {
    typhoon.landfallRecords.forEach((r) => {
      landfalls.push({
        lat: r.lat,
        lon: r.lon,
        wind: r.vmax,
        time: r.simHour,
        region: r.region
      });
    });
  } else {
    let wasLanded = false;
    typhoon.history.forEach((h) => {
      if (h.landed && !wasLanded) {
        const metrics = getLandMetrics(h.lat, h.lon);
        const region = metrics.landName || "沿海地区";

        landfalls.push({
          lat: h.lat,
          lon: h.lon,
          wind: h.vmax,
          time: h.simHour,
          region
        });
      }
      wasLanded = h.landed;
    });
  }

  const lifeCycleHours = typhoon.history.length > 0 
    ? typhoon.history[typhoon.history.length - 1].simHour 
    : 0;

  const getImpactAssessment = (maxV: number) => {
    if (maxV >= 51.0) {
      return {
        severity: "极度严重 (Category 5)",
        color: "text-indigo-400 border-indigo-500/30 bg-purple-500/10",
        description: "超强台风级。风力排山倒海，沿海遭遇毁灭性破坏。多处海堤决口，高层建筑损毁明显，基础设施大范围瘫痪，行道树及农作物大面积损毁。需防灾全面救灾响应。"
      };
    } else if (maxV >= 41.5) {
      return {
        severity: "严重灾害 (Category 4)",
        color: "text-red-400 border-red-500/30 bg-red-500/10",
        description: "强台风级。沿岸码头与简易工棚严重损毁，狂风席卷地带，高层建筑幕墙部分损毁。农业大面积受灾，山区地带滑坡风险极高。电力和自来水可能部分中断。"
      };
    } else if (maxV >= 32.7) {
      return {
        severity: "中等偏重 (Category 2-3)",
        color: "text-orange-400 border-orange-500/30 bg-orange-500/10",
        description: "台风级。简易板房及广告牌受损，部分大树被强风折断，积水严重的市区路段有明显内涝，中小河流出现汛情。需加强地质灾害防御和内涝抽排。"
      };
    } else if (maxV >= 24.4) {
      return {
        severity: "中度灾害",
        color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
        description: "强热带风暴级。对沿海渔船、海上作业及港口秩序造成较大影响。陆地偶有树木折断与路面积水，需防御短时局部强降雨。"
      };
    } else {
      return {
        severity: "轻度影响",
        color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
        description: "热带风暴及以下级别。除海上交通略受干扰外，整体影响相对轻微，降雨充沛有利于缓解高温伏旱，增加水库蓄水量。"
      };
    }
  };

  const impact = getImpactAssessment(maxWind);

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl my-auto min-h-[90vh] md:min-h-0 md:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Award className="w-7 h-7 text-yellow-500" />
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">台风模拟总结报告</h2>
              <p className="text-sm text-slate-400 font-medium">Typhoon Lifetime Simulation Summary</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Top Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center shadow-md">
              <span className="text-xs text-slate-400 font-semibold mb-1">台风名称</span>
              <span className="text-lg sm:text-xl font-extrabold text-white">{typhoon.name}</span>
            </div>
            
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center shadow-md">
              <span className="text-xs text-slate-400 font-semibold mb-1">生命周期</span>
              <span className="text-lg sm:text-xl font-extrabold text-[#1E9CFF] font-mono">{lifeCycleHours} <span className="text-xs font-normal">小时</span></span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center shadow-md">
              <span className="text-xs text-slate-400 font-semibold mb-1">生命史极大风速</span>
              <span className="text-lg sm:text-xl font-extrabold text-rose-500 font-mono">{maxWind.toFixed(1)} <span className="text-xs font-normal">m/s</span></span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center shadow-md">
              <span className="text-xs text-slate-400 font-semibold mb-1">生命史最低气压</span>
              <span className="text-lg sm:text-xl font-extrabold text-teal-400 font-mono">{minPressure.toFixed(0)} <span className="text-xs font-normal">hPa</span></span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center shadow-md">
              <span className="text-xs text-slate-400 font-semibold mb-1">总伤亡人数估算</span>
              <span className="text-lg sm:text-xl font-extrabold text-red-400 font-mono">
                {Math.floor(typhoon.casualties || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">人</span>
              </span>
            </div>
          </div>

          {/* Landfalls & Disaster Impact */}
          <div className="w-full">
            
            {/* Landfall Records */}
            <div className="bg-slate-950/50 border border-slate-800/80 p-5 rounded-xl flex flex-col w-full shadow-md">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Compass className="w-5 h-5 text-blue-400" />
                登陆事件记录
              </h3>
              
              {landfalls.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-slate-400 text-sm font-medium">
                  <CheckCircle className="w-8 h-8 text-teal-500/60 mb-2 animate-bounce" />
                  <span>本系统未曾在陆地区域登陆，为海上消散或转向路径。</span>
                </div>
              ) : (
                <div className="flex-1 space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                  {landfalls.map((land, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-orange-500/20 text-amber-300 text-xs font-bold">第 {idx + 1} 次登陆</span>
                          {land.region}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 font-medium">
                          位置: {land.lat.toFixed(2)}°N, {land.lon.toFixed(2)}°E | 模拟第 {land.time} 小时
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-rose-400 font-mono">{land.wind.toFixed(1)} m/s</div>
                        <div className="text-xs text-slate-400">登陆风速</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Lifetime Curves */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Wind Chart */}
            <div className="bg-slate-950/50 border border-slate-800/80 p-5 rounded-xl shadow-md">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-400" />
                中心最大风速演变 (m/s)
              </h3>
              <div className="h-56 w-full bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(val) => `${val}h`}
                      label={{ value: '生成时间 (小时)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      label={{ value: '风速 (m/s)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '13px' }}
                      labelFormatter={(val) => `第 ${val} 小时`}
                    />
                    <Line type="monotone" dataKey="wind" name="中心风速" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pressure Chart */}
            <div className="bg-slate-950/50 border border-slate-800/80 p-5 rounded-xl shadow-md">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                最低中心气压演变 (hPa)
              </h3>
              <div className="h-56 w-full bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(val) => `${val}h`}
                      label={{ value: '生成时间 (小时)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      domain={['auto', 'auto']}
                      tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      label={{ value: '气压 (hPa)', angle: -90, position: 'insideRight', fill: '#94a3b8', fontSize: 12 }}
                      orientation="right"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '13px' }}
                      labelFormatter={(val) => `第 ${val} 小时`}
                    />
                    <Line type="monotone" dataKey="pressure" name="最低气压" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            onClick={() => {
              if (onOpenVideoExport) {
                onOpenVideoExport(typhoon);
              } else {
                setShowVideoExportModal(true);
              }
            }}
            className="h-10 px-5 text-sm font-medium bg-teal-600 hover:bg-teal-500 active:bg-teal-700 border border-teal-500/50 text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Video className="w-4 h-4" />
            <span>生成视频</span>
          </button>
          <button
            onClick={() => {
              if (onOpenReportModal) {
                onOpenReportModal(typhoon);
              } else {
                setShowTyphoonReportModal(true);
              }
            }}
            className="h-10 px-5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 border border-indigo-500/50 text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>生成台风报告</span>
          </button>
          <button 
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>关闭</span>
          </button>
        </div>
      </div>
      
      {showVideoExportModal && (
        <VideoExportModal
          typhoon={typhoon}
          startDate={startDate}
          onClose={() => setShowVideoExportModal(false)}
        />
      )}

      {showTyphoonReportModal && (
        <TyphoonReportModal
          typhoon={typhoon}
          startDate={startDate}
          onClose={() => setShowTyphoonReportModal(false)}
        />
      )}
    </div>
  );
}

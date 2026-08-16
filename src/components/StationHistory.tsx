import { X, Wind, Compass, Droplet, Users, AlertTriangle, CloudRain, FileSpreadsheet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { useState } from "react";
import { Typhoon } from "../types";
import StationReportModal from "./StationReportModal";

interface StationHistoryProps {
  station: { id: string; name: string; lat: number; lon: number };
  typhoons: Typhoon[];
  startDate?: Date;
  onClose: () => void;
}

// Simple Beaufort scale helper
function getBeaufortLabel(windMps: number): string {
  if (windMps < 0.3) return "0级 无风";
  if (windMps < 1.6) return "1级 软风";
  if (windMps < 3.4) return "2级 轻风";
  if (windMps < 5.5) return "3级 微风";
  if (windMps < 8.0) return "4级 和风";
  if (windMps < 10.8) return "5级 清风";
  if (windMps < 13.9) return "6级 强风";
  if (windMps < 17.2) return "7级 疾风";
  if (windMps < 20.8) return "8级 大风";
  if (windMps < 24.5) return "9级 烈风";
  if (windMps < 28.5) return "10级 狂风";
  if (windMps < 32.7) return "11级 暴风";
  if (windMps < 37.0) return "12级 台风";
  if (windMps < 41.5) return "13级 强台风";
  if (windMps < 46.2) return "14级 强台风";
  if (windMps < 51.0) return "15级 强台风";
  if (windMps < 56.1) return "16级 超强台风";
  return "17级及以上 超强台风";
}

export default function StationHistory({ station, typhoons, startDate, onClose }: StationHistoryProps) {
  const [showReportModal, setShowReportModal] = useState(false);

  if (typhoons.length === 0) return null;
  const ty = typhoons[0];
  const currentHour = ty.simHour;

  // Find the history entry at the currentHour (or fallback to latest)
  const activeState = ty.history.find(h => h.simHour === currentHour) || ty.history[ty.history.length - 1];
  const reading = activeState?.stationReadings?.find(r => r.name === station.name) || ty?.stationReadings?.find(r => r.name === station.name);

  // Read metrics directly
  const windSpeed = reading ? reading.windSpeed : 0;
  const pressure = reading ? reading.pressure : 1013;
  const casualties = reading ? reading.casualties : 0;
  const precipitation = reading ? reading.precipitation : 0;
  const maxWindSpeed = reading ? reading.maxWindSpeed : 0;
  const accumPrecip = reading ? reading.accumPrecip : 0;

  // Generate historical data from 0 up to currentHour for the charts
  const historyData = ty.history
    .filter(h => h.simHour <= currentHour)
    .map(h => {
      const r = h.stationReadings?.find(s => s.name === station.name);
      if (r) {
        return {
          time: h.simHour,
          wind: r.windSpeed,
          pressure: r.pressure,
          precipitation: r.precipitation,
          casualties: r.casualties
        };
      } else {
        // Analytical fallback
        const dLatKm = (station.lat - h.lat) * 111.12;
        const dLonKm = (station.lon - h.lon) * 111.12 * Math.cos(h.lat * Math.PI / 180);
        const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
        const rmw = h.rmw || 35;
        let w = 0;
        let p = 1013;
        if (dist <= rmw) {
          w = h.vmax * (dist / rmw);
          p = h.pmin + (1013 - h.pmin) * Math.pow(dist / rmw, 2) * 0.5;
        } else {
          const envelope = Math.exp(-(dist - rmw) / (h.vmax * 5.0 + 70));
          w = h.vmax * envelope;
          p = 1013 - (1013 - h.pmin) * envelope;
        }
        return {
          time: h.simHour,
          wind: Number(w.toFixed(1)),
          pressure: Number(p.toFixed(1)),
          precipitation: 0,
          casualties: 0
        };
      }
    });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">{station.name}气象站</h2>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              ({station.lat.toFixed(2)}°N, {station.lon.toFixed(2)}°E)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="px-3 py-1.5 bg-[#1E9CFF] hover:bg-[#1E9CFF]/90 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-[#1E9CFF]/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              制作报告图
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick-Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* Wind Speed Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-blue-500/10 border border-cyan-500/20 text-blue-400 rounded-lg">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">实时风速 / 级</div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {windSpeed.toFixed(1)} <span className="text-xs font-normal text-slate-500">m/s</span>
                </div>
                <div className="text-[10px] text-blue-400/80 font-medium">{getBeaufortLabel(windSpeed)}</div>
              </div>
            </div>

            {/* Pressure Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-indigo-400 rounded-lg">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">实时气压</div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {pressure.toFixed(1)} <span className="text-xs font-normal text-slate-500">hPa</span>
                </div>
                <div className="text-[10px] text-indigo-400/80 font-medium">中心外围气压压降</div>
              </div>
            </div>

            {/* Precipitation Rate Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                <CloudRain className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">当前降水量 (小时)</div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {precipitation.toFixed(1)} <span className="text-xs font-normal text-slate-500">mm/h</span>
                </div>
                <div className="text-[10px] text-blue-400/80 font-medium">
                  {precipitation > 50 ? "特大暴雨" : precipitation > 30 ? "大暴雨" : precipitation > 10 ? "暴雨" : "小到中雨"}
                </div>
              </div>
            </div>

            {/* Accumulated Precipitation Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <Droplet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">累计总降水量</div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {accumPrecip.toFixed(1)} <span className="text-xs font-normal text-slate-500">mm</span>
                </div>
                <div className="text-[10px] text-indigo-400/80 font-medium">本次过程站网累积</div>
              </div>
            </div>

            {/* Max Wind Speed Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-orange-400 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">历史最高风速</div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {maxWindSpeed.toFixed(1)} <span className="text-xs font-normal text-slate-500">m/s</span>
                </div>
                <div className="text-[10px] text-orange-400/80 font-medium">最大风速</div>
              </div>
            </div>

            {/* Casualties Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">区域伤亡估算</div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {casualties} <span className="text-xs font-normal text-slate-500">人</span>
                </div>
                <div className="text-[10px] text-rose-400/80 font-medium">基于灾损与人口密度</div>
              </div>
            </div>

          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Wind Curve */}
            <div className="bg-slate-950/20 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  实时风速演变曲线
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  <span className="text-blue-400">■ 风速(m/s)</span>
                </span>
              </h3>
              <div className="h-64 w-full bg-slate-950/50 rounded-lg p-2 border border-slate-800/30">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#475569" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) => `${val}h`}
                    />
                    <YAxis 
                      stroke="#06b6d4" 
                      tick={{ fill: '#06b6d4', fontSize: 11 }} 
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: 12 }}
                      labelFormatter={(val) => `第 ${val} 小时`}
                    />
                    <Line type="monotone" dataKey="wind" name="实时风速 (m/s)" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pressure Curve */}
            <div className="bg-slate-950/20 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                气压压降演变曲线 (hPa)
              </h3>
              <div className="h-64 w-full bg-slate-950/50 rounded-lg p-2 border border-slate-800/30">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#475569" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) => `${val}h`}
                    />
                    <YAxis 
                      stroke="#475569" 
                      domain={['auto', 'auto']}
                      tick={{ fill: '#64748b', fontSize: 11 }} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: 12 }}
                      labelFormatter={(val) => `第 ${val} 小时`}
                    />
                    <Line type="monotone" dataKey="pressure" name="测站气压" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Precipitation Curve */}
            <div className="bg-slate-950/20 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                小时降雨演变曲线 (mm/h)
              </h3>
              <div className="h-64 w-full bg-slate-950/50 rounded-lg p-2 border border-slate-800/30">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#475569" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) => `${val}h`}
                    />
                    <YAxis 
                      stroke="#475569" 
                      tick={{ fill: '#64748b', fontSize: 11 }} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: 12 }}
                      labelFormatter={(val) => `第 ${val} 小时`}
                    />
                    <Line type="monotone" dataKey="precipitation" name="小时降水" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-800/40 mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">仅显示受台风影响的数据 | 中央气象台监测点</div>
            <button
              onClick={() => setShowReportModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#1E9CFF] to-cyan-500 hover:from-[#1E9CFF]/90 hover:to-cyan-500/90 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#1E9CFF]/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              制作站点气象报告图 (生成高清图片)
            </button>
          </div>

        </div>
      </div>

      {showReportModal && (
        <StationReportModal
          station={station}
          typhoons={typhoons}
          startDate={startDate}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
